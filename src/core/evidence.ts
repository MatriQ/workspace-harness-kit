import type { Artifact, AttemptResult, Check, CheckResult, EvidenceRecord, EvaluationResult, Observation, ObservationStatus, Target } from './types.js';
import { equal, fullMatch, isObject, sorted } from './json.js';

export const CHECKS: readonly Check[] = ['business', 'deployment', 'technical', 'version'];
const STATUSES = ['passed', 'failed', 'pending', 'not run'];
const ARTIFACTS = ['git_commit', 'oci_manifest_digest', 'oci_index_digest', 'package_version', 'runtime_revision'];
export class EvidenceError extends Error { override name = 'EvidenceError'; }
export function requireEvidence(condition: unknown, message: string): asserts condition {
  if (!condition) throw new EvidenceError(message);
}
export function object(value: unknown, name: string, required: string[], optional: string[] = []): asserts value is Record<string, unknown> {
  requireEvidence(isObject(value), `${name} must be an object`);
  requireEvidence(required.every(key => Object.hasOwn(value, key)), `${name} is missing required fields`);
  requireEvidence(Object.keys(value).every(key => [...required, ...optional].includes(key)), `${name} has unknown fields`);
}
export function text(value: unknown, name: string): asserts value is string {
  requireEvidence(typeof value === 'string' && value.trim() && [...value].length <= 2000,
    `${name} must be nonempty text (at most 2000 characters)`);
}
export function identifier(value: unknown, name: string): asserts value is string {
  requireEvidence(typeof value === 'string' && fullMatch(/^[a-z0-9][a-z0-9._-]*$/, value), `Invalid ${name}`);
}
export function timestamp(value: unknown): number {
  text(value, 'timestamp');
  // Reject invalid calendar dates and timezone-less input instead of accepting Date's normalization.
  const match = /^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  requireEvidence(match && match[0] === value, 'Timestamp must be an ISO 8601 datetime with a timezone');
  const [, y, m, d, h, min, s, fraction = '', zone] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  requireEvidence(year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
    && Number(h) < 24 && Number(min) < 60 && Number(s) < 60
    && (zone === 'Z' || (Number(zone.slice(1, 3)) < 24 && Number(zone.slice(4)) < 60)), 'Invalid timestamp');
  const milliseconds = Date.parse(`${y}-${m}-${d}T${h}:${min}:${s}${zone}`) + Number(`0.${fraction || '0'}`) * 1000;
  requireEvidence(Number.isFinite(milliseconds), 'Invalid timestamp');
  return milliseconds;
}
function isoTime(time: number): string {
  const seconds = Math.floor(time / 1000) * 1000;
  const fraction = Math.round((time - seconds) * 1000);
  return new Date(seconds).toISOString().replace('.000Z', fraction ? `.${String(fraction).padStart(6, '0')}+00:00` : '+00:00');
}
export function validateTarget(value: unknown): asserts value is Target {
  object(value, 'target', ['environment', 'identity']);
  for (const [key, item] of Object.entries(value)) text(item, `target.${key}`);
}
export function validateArtifact(value: unknown): asserts value is Artifact {
  object(value, 'artifact', ['kind', 'value'], ['platform']);
  requireEvidence(typeof value.kind === 'string' && ARTIFACTS.includes(value.kind), 'Unsupported artifact identity kind; mutable tags are not evidence');
  text(value.value, 'artifact.value');
  if ('platform' in value) text(value.platform, 'artifact.platform');
  if (value.kind === 'git_commit') requireEvidence(fullMatch(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/, value.value), 'git_commit requires a full lowercase SHA');
  else if (value.kind.startsWith('oci_')) requireEvidence(fullMatch(/^sha256:[a-f0-9]{64}$/, value.value), 'OCI identities require a sha256 digest');
  else requireEvidence(!['latest', 'main', 'master', 'head', 'unknown'].includes(value.value.toLowerCase())
    && !/[\s*^~<>=]/.test(value.value), 'Artifact must be an exact resolved version or revision');
}
export function validateRefs(values: unknown): asserts values is string[] {
  requireEvidence(Array.isArray(values), 'Evidence references must be a list');
  for (const value of values) {
    text(value, 'evidence reference');
    requireEvidence(!/[\r\n]/.test(value) && [...value].length <= 500, 'Use short evidence references, not raw logs');
    if (value.includes('://')) {
      let url: URL;
      try { url = new URL(value); } catch { throw new EvidenceError('Invalid evidence URL'); }
      requireEvidence(!url.username && !url.password && !url.search && !url.hash,
        'Evidence URLs must not contain user credentials, queries, or fragments');
    }
  }
}
export function uniqueNames(values: unknown, name: string): asserts values is string[] {
  requireEvidence(Array.isArray(values), `${name} must be a list`);
  for (const value of values) identifier(value, name);
  requireEvidence(values.length === new Set(values).size, `Repeated ${name}`);
}
function group(item: Observation): string { return JSON.stringify([item.component === undefined ? 'journey' : 'component', item.component ?? item.journey, item.check]); }
export function validateEvidence(record: unknown): asserts record is EvidenceRecord {
  object(record, 'record', ['schema_version', 'release', 'scope', 'observations'], ['capability']);
  requireEvidence(record.schema_version === 1, 'Expected evidence schema_version 1');
  text(record.release, 'release');
  if ('capability' in record) identifier(record.capability, 'capability');
  const scope = record.scope;
  object(scope, 'scope', ['target', 'max_age_seconds', 'components', 'journeys']);
  validateTarget(scope.target);
  requireEvidence(Number.isSafeInteger(scope.max_age_seconds) && Number(scope.max_age_seconds) > 0, 'max_age_seconds must be a positive integer');
  requireEvidence(Array.isArray(scope.components) && scope.components.length, 'Scope needs at least one required component');
  const components = new Map<string, Record<string, unknown>>();
  for (const component of scope.components) {
    object(component, 'component', ['id', 'artifact', 'required_checks', 'not_applicable', 'criteria']);
    identifier(component.id, 'component ID');
    requireEvidence(!components.has(component.id), `Repeated component: ${component.id}`);
    validateArtifact(component.artifact);
    uniqueNames(component.required_checks, 'required check');
    const required = component.required_checks, excluded = component.not_applicable;
    requireEvidence(isObject(excluded), 'not_applicable must map check names to reasons');
    requireEvidence(!required.some(key => Object.hasOwn(excluded, key))
      && equal([...required, ...Object.keys(excluded)].sort(), CHECKS), 'Every component must explicitly classify all four checks');
    requireEvidence(required.includes('version'), 'Running artifact verification is required for every release component');
    for (const reason of Object.values(excluded)) text(reason, 'not_applicable reason');
    requireEvidence(isObject(component.criteria) && equal(Object.keys(component.criteria).sort(), [...required].sort()), 'criteria must define every required check and no others');
    for (const criterion of Object.values(component.criteria)) text(criterion, 'criterion');
    components.set(component.id, component);
  }
  requireEvidence(Array.isArray(scope.journeys), 'journeys must be a list');
  const journeys = new Map<string, Record<string, unknown>>();
  for (const journey of scope.journeys) {
    object(journey, 'journey', ['id', 'components', 'criterion']);
    identifier(journey.id, 'journey ID');
    requireEvidence(!journeys.has(journey.id), `Repeated journey: ${journey.id}`);
    uniqueNames(journey.components, 'journey component');
    requireEvidence(journey.components.length && journey.components.every(key => components.has(key)), 'Journey needs known participating components');
    text(journey.criterion, 'journey criterion');
    journeys.set(journey.id, journey);
  }
  requireEvidence(Array.isArray(record.observations), 'observations must be a list');
  const attempts = new Map<string, Map<number, number>>();
  for (const item of record.observations) {
    object(item, 'observation', ['check', 'attempt', 'status', 'target', 'observed_at', 'summary', 'evidence'], ['component', 'journey', 'artifact', 'artifacts']);
    requireEvidence(('component' in item) !== ('journey' in item), 'Observation needs exactly one component or journey');
    const key = 'component' in item ? item.component : item.journey;
    identifier(key, 'subject');
    requireEvidence(typeof item.check === 'string' && (CHECKS as readonly string[]).includes(item.check), 'Unknown observation check');
    if ('component' in item) {
      const component = components.get(key);
      requireEvidence(component, `Observation has unknown component: ${key}`);
      requireEvidence((component.required_checks as string[]).includes(item.check), "Observation conflicts with scope's not_applicable decision");
      requireEvidence(!('artifacts' in item), 'Only journeys carry an artifacts map');
      requireEvidence(!('artifact' in item) || ['version', 'technical', 'business'].includes(item.check), 'Only version, technical and component business checks carry an artifact');
    } else {
      requireEvidence(journeys.has(key) && item.check === 'business', 'Journey observations must be business checks of a known journey');
      requireEvidence(!('artifact' in item), 'Journeys use an artifacts map');
    }
    requireEvidence(Number.isSafeInteger(item.attempt) && Number(item.attempt) > 0, 'attempt must be a positive integer');
    requireEvidence(typeof item.status === 'string' && STATUSES.includes(item.status), 'Unknown observation status');
    validateTarget(item.target);
    const time = timestamp(item.observed_at);
    text(item.summary, 'summary');
    validateRefs(item.evidence);
    if (item.status !== 'pending') requireEvidence(item.evidence.length, 'An asserted result needs evidence references');
    if ('artifact' in item) validateArtifact(item.artifact);
    if ('artifacts' in item) {
      requireEvidence(isObject(item.artifacts), 'artifacts must be a component-to-identity map');
      const participants = journeys.get(key)!.components as string[];
      requireEvidence(Object.keys(item.artifacts).every(id => participants.includes(id)), 'Journey has unexpected component identities');
      for (const artifact of Object.values(item.artifacts)) validateArtifact(artifact);
    }
    const id = group(item as unknown as Observation);
    const bucket = attempts.get(id) ?? new Map<number, number>();
    requireEvidence(!bucket.has(Number(item.attempt)), `Repeated attempt: ${id}`);
    bucket.set(Number(item.attempt), time);
    attempts.set(id, bucket);
  }
  for (const bucket of attempts.values()) {
    const times = [...bucket].sort(([a], [b]) => a - b).map(([, time]) => time);
    requireEvidence(times.every((time, i) => i === 0 || time >= times[i - 1]), 'Later attempts cannot predate earlier attempts');
  }
}
export function compareArtifacts(expected: Artifact, actual?: Artifact): [ObservationStatus, string] {
  if (!actual) return ['pending', 'Running artifact identity is unavailable'];
  if (expected.kind !== actual.kind || expected.platform !== actual.platform) return ['pending', 'Artifact identities have different kinds or platform scopes; supply a trusted same-kind mapping'];
  if (expected.value !== actual.value) return ['failed', 'Observed artifact differs from the expected artifact'];
  return ['passed', 'Observed artifact matches'];
}
export function evaluate(record: unknown, at: string | Date = new Date()): EvaluationResult {
  validateEvidence(record);
  const now = at instanceof Date ? at.getTime() : timestamp(at);
  requireEvidence(Number.isFinite(now), 'Invalid evaluation time');
  const { scope } = record;
  const components = new Map(scope.components.map(item => [item.id, item]));
  const journeys = new Map(scope.journeys.map(item => [item.id, item]));
  const attempts = new Map<string, Observation[]>();
  for (const item of record.observations) attempts.set(group(item), [...(attempts.get(group(item)) ?? []), item]);
  function observationResult(item: Observation): AttemptResult {
    let status = item.status, reason = item.summary;
    const age = (now - timestamp(item.observed_at)) / 1000;
    if (!equal(item.target, scope.target)) [status, reason] = ['failed', 'Observed target differs from the requested target'];
    else if (age < 0 || age > scope.max_age_seconds) [status, reason] = ['pending', 'Observation is from the future or outside the freshness window'];
    else if (status === 'passed') {
      if (item.component !== undefined && ['version', 'technical', 'business'].includes(item.check)) [status, reason] = compareArtifacts(components.get(item.component)!.artifact, item.artifact);
      else if (item.journey !== undefined) {
        const comparisons = journeys.get(item.journey)!.components.map(key => compareArtifacts(components.get(key)!.artifact, item.artifacts?.[key]));
        if (comparisons.some(([value]) => value === 'failed')) [status, reason] = ['failed', 'Journey exercised a different component artifact'];
        else if (comparisons.some(([value]) => value === 'pending')) [status, reason] = ['pending', 'Journey lacks comparable identities for all participating components'];
      }
    }
    return { attempt: item.attempt, status, reported_status: item.status, reason, summary: item.summary,
      target: item.target, observed_at: item.observed_at, evidence: item.evidence,
      ...(item.artifact ? { artifact: item.artifact } : {}), ...(item.artifacts ? { artifacts: item.artifacts } : {}) };
  }
  const rows: CheckResult[] = [];
  function add(subject: 'component' | 'journey', key: string, check: Check, criterion: string): void {
    const history = (attempts.get(JSON.stringify([subject, key, check])) ?? []).sort((a, b) => a.attempt - b.attempt).map(observationResult);
    const latest = history.at(-1) ?? { status: 'pending' as const, reason: 'Required observation is missing' };
    const row: CheckResult = { subject, id: key, check, criterion, status: latest.status, reason: latest.reason,
      attempts: history, recovered: latest.status === 'passed' && history.slice(0, -1).some(item => item.status === 'failed') };
    if (subject === 'component' && ['version', 'technical', 'business'].includes(check)) row.expected_artifact = components.get(key)!.artifact;
    else if (subject === 'journey') row.expected_artifacts = Object.fromEntries(journeys.get(key)!.components.map(name => [name, components.get(name)!.artifact]));
    rows.push(row);
  }
  for (const component of scope.components) for (const check of CHECKS) {
    if (Object.hasOwn(component.not_applicable, check)) rows.push({ subject: 'component', id: component.id, check,
      status: 'not applicable', reason: component.not_applicable[check]!, attempts: [], recovered: false });
    else add('component', component.id, check, component.criteria[check]!);
  }
  for (const journey of scope.journeys) add('journey', journey.id, 'business', journey.criterion);
  const verdict = rows.some(row => row.status === 'failed') ? 'failed'
    : rows.every(row => ['passed', 'not applicable'].includes(row.status)) ? 'passed' : 'pending';
  return structuredClone({ schema_version: 1, release: record.release, target: scope.target, evaluated_at: isoTime(now), verdict, checks: rows });
}
export function markdown(result: EvaluationResult): string {
  const cell = (value: unknown) => String(value).replaceAll('|', '\\|').replace(/[\n\r]/g, ' ');
  const lines = [`Release: ${cell(result.release)}`, `Verdict: **${result.verdict}**`, '', '| Subject | Check | Status | Reason |', '| --- | --- | --- | --- |'];
  for (const row of result.checks) lines.push(`| ${[row.id, row.check, row.status, row.reason].map(cell).join(' | ')} |`);
  lines.push('', 'Attempt history:');
  for (const row of result.checks) for (const item of row.attempts) {
    lines.push(`- ${cell(row.id)}/${row.check} attempt ${item.attempt}: ${item.status}; ${cell(item.observed_at)}; ${cell(item.evidence.join('; '))}; ${cell(item.reason)}; observation: ${cell(item.summary)}`);
    if (item.artifact || item.artifacts) lines.push(`  Observed: ${cell(JSON.stringify(sorted(item.artifact ?? item.artifacts)))}`);
  }
  return lines.join('\n');
}
