import { identifier, object, requireEvidence, text, timestamp, validateArtifact, validateRefs, validateTarget } from './evidence.js';
import { equal, fullMatch, isObject } from './json.js';
import type { Artifact, ObservationStatus, Target, Verdict } from './types.js';

export interface VerificationCheck { id: string; layer: string; target: Target; criterion: string; artifact?: Artifact }
export interface VerificationObservation {
  check: string; attempt: number; binding: string; status: ObservationStatus; target: Target; artifact?: Artifact;
  observed_at: string; summary: string; evidence: string[]; method: 'attestation' | 'probe';
}
export interface VerificationRecord { schema_version: 1; observations: VerificationObservation[] }
export interface DiagnosticCheck extends VerificationCheck {
  layer: 'tool' | 'access' | 'smoke' | 'ci';
  platform?: string;
  probe?: { argv: string[]; cwd?: string; member?: string; timeout_seconds: number; expect_json?: Record<string, unknown> };
}
export interface DiagnosticSpec { max_age_seconds: number; checks: DiagnosticCheck[] }
export function validateDiagnosticSpec(value: unknown, relative: (value: unknown) => void): asserts value is DiagnosticSpec {
  object(value, 'verification', ['max_age_seconds', 'checks']);
  requireEvidence(Number.isSafeInteger(value.max_age_seconds) && Number(value.max_age_seconds) > 0, 'max_age_seconds must be positive');
  requireEvidence(Array.isArray(value.checks), 'checks must be a list');
  const ids = new Set<string>();
  for (const check of value.checks) {
    object(check, 'diagnostic check', ['id', 'layer', 'target', 'criterion'], ['artifact', 'probe', 'platform']);
    identifier(check.id, 'check ID'); requireEvidence(!check.id.startsWith('harness-') && !ids.has(check.id), 'Duplicate or reserved check ID'); ids.add(check.id);
    requireEvidence(['tool', 'access', 'smoke', 'ci'].includes(String(check.layer)), 'Native agent and hook activation require session attestations, not command probes');
    validateTarget(check.target); text(check.criterion, 'criterion'); if ('artifact' in check) validateArtifact(check.artifact);
    if ('platform' in check) identifier(check.platform, 'platform');
    if ('probe' in check) {
      requireEvidence(check.layer !== 'ci', 'CI execution requires an actual CI run reference');
      object(check.probe, 'probe', ['argv', 'timeout_seconds'], ['cwd', 'member', 'expect_json']);
      requireEvidence(Array.isArray(check.probe.argv) && check.probe.argv.length > 0 && check.probe.argv.length <= 100, 'Probe argv must be nonempty');
      for (const arg of check.probe.argv) requireEvidence(typeof arg === 'string' && arg.length > 0 && arg.length <= 2000 && !/[\x00-\x1f]/.test(arg), 'Use literal bounded probe arguments without secrets');
      requireEvidence(Number.isSafeInteger(check.probe.timeout_seconds) && Number(check.probe.timeout_seconds) > 0 && Number(check.probe.timeout_seconds) <= 60, 'Probe timeout must be between 1 and 60 seconds');
      if ('cwd' in check.probe) relative(check.probe.cwd);
      if ('member' in check.probe) identifier(check.probe.member, 'probe member');
      if ('expect_json' in check.probe) requireEvidence(isObject(check.probe.expect_json) && Object.keys(check.probe.expect_json).length > 0, 'expect_json must be a nonempty object');
      if (check.layer === 'access' || check.layer === 'smoke') requireEvidence(isObject(check.probe.expect_json) && equal(check.probe.expect_json.target, check.target), 'Access and smoke probes must assert the observed target in expect_json.target');
      if (check.artifact) requireEvidence(isObject(check.probe.expect_json) && equal(check.probe.expect_json.artifact, check.artifact), 'Artifact-bound probes must assert expect_json.artifact');
    }
  }
}
export function validateVerificationRecord(value: unknown): asserts value is VerificationRecord {
  object(value, 'verification record', ['schema_version', 'observations']); requireEvidence(value.schema_version === 1, 'Expected verification schema_version 1');
  requireEvidence(Array.isArray(value.observations), 'observations must be a list');
  const attempts = new Set<string>();
  for (const item of value.observations) {
    object(item, 'verification observation', ['check', 'attempt', 'binding', 'status', 'target', 'observed_at', 'summary', 'evidence', 'method'], ['artifact']);
    identifier(item.check, 'observation check'); requireEvidence(Number.isSafeInteger(item.attempt) && Number(item.attempt) > 0, 'attempt must be positive');
    requireEvidence(typeof item.binding === 'string' && fullMatch(/^[a-f0-9]{64}$/, item.binding), 'Observation needs its exact configuration binding');
    requireEvidence(['passed', 'failed', 'pending', 'not run'].includes(String(item.status)), 'Invalid observation status');
    requireEvidence(['attestation', 'probe'].includes(String(item.method)), 'Invalid observation method');
    validateTarget(item.target); timestamp(item.observed_at); text(item.summary, 'summary'); validateRefs(item.evidence);
    if ('artifact' in item) validateArtifact(item.artifact);
    const key = `${item.check}/${item.attempt}`; requireEvidence(!attempts.has(key), 'Repeated observation attempt'); attempts.add(key);
  }
}
export function evaluateVerification(checks: VerificationCheck[], record: unknown, binding: string, maxAge: number, at: string) {
  validateVerificationRecord(record); const now = timestamp(at);
  requireEvidence(Array.isArray(checks) && checks.length > 0 && new Set(checks.map(check => check.id)).size === checks.length, 'Verification requires unique nonempty checks');
  requireEvidence(typeof binding === 'string' && fullMatch(/^[a-f0-9]{64}$/, binding), 'Invalid verification binding');
  requireEvidence(Number.isSafeInteger(maxAge) && maxAge > 0, 'Invalid verification age limit');
  for (const check of checks) { identifier(check.id, 'check ID'); text(check.layer, 'layer'); text(check.criterion, 'criterion'); validateTarget(check.target); if (check.artifact) validateArtifact(check.artifact); }
  const ids = new Set(checks.map(check => check.id));
  for (const observation of record.observations) requireEvidence(ids.has(observation.check), `Unknown verification check: ${observation.check}`);
  const rows = checks.map(check => {
    const history = record.observations.filter(item => item.check === check.id).sort((a, b) => a.attempt - b.attempt).map(item => {
      let status: Verdict = item.status === 'failed' ? 'failed' : item.status === 'passed' ? 'passed' : 'pending';
      let reason = item.summary;
      const age = now - timestamp(item.observed_at);
      if (!equal(item.target, check.target)) { status = 'failed'; reason = 'Observed target differs from the required target'; }
      else if (item.binding !== binding) { status = 'pending'; reason = 'Observation belongs to another configuration or checkout'; }
      else if (age < 0 || age > maxAge * 1000) { status = 'pending'; reason = 'Observation is stale or future-dated'; }
      else if (status === 'passed' && !item.evidence.length) { status = 'pending'; reason = 'A passing observation needs evidence references'; }
      else if (status === 'passed' && check.artifact && !equal(item.artifact, check.artifact)) {
        status = item.artifact && item.artifact.kind === check.artifact.kind && item.artifact.platform === check.artifact.platform ? 'failed' : 'pending';
        reason = 'Tested artifact does not establish the required artifact identity';
      }
      if ((check.layer === 'agent' || check.layer === 'hook') && item.method !== 'attestation') { status = 'pending'; reason = 'Direct script execution does not establish native host activation'; }
      return { ...item, status, reason };
    });
    for (let i = 1; i < history.length; i++) requireEvidence(timestamp(history[i].observed_at) >= timestamp(history[i - 1].observed_at), 'Retry times must not move backwards');
    const latest = history.at(-1);
    return { ...check, status: latest?.status ?? 'pending', reason: latest?.reason ?? 'No observation', recovered: latest?.status === 'passed' && history.slice(0, -1).some(item => item.status === 'failed'), history };
  });
  const status: Verdict = rows.some(row => row.status === 'failed') ? 'failed' : rows.some(row => row.status === 'pending') ? 'pending' : 'passed';
  return { schema_version: 1, binding, evaluated_at: at, status, checks: rows };
}
/** Expected JSON is a subset of observed JSON; arrays are exact and unexpected output is never persisted. */
export function matchesJson(actual: unknown, expected: unknown): boolean {
  if (isObject(expected)) return isObject(actual) && Object.entries(expected).every(([key, value]) => Object.hasOwn(actual, key) && matchesJson(actual[key], value));
  return equal(actual, expected);
}
