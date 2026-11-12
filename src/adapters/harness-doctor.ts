import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateHarnessSpec } from '../core/harness.js';
import { isObject, json } from '../core/json.js';
import { evaluateVerification, matchesJson, validateVerificationRecord } from '../core/verification.js';
import type { DiagnosticCheck, VerificationCheck, VerificationObservation, VerificationRecord } from '../core/verification.js';
import { HARNESS_RECEIPT, HARNESS_SPEC, sourcePath } from './harness.js';
import { checkHarness } from './harness-check.js';
import { fileHash, hash, readJson, resolvePath, stat, within } from './files.js';

export interface DiagnosticExecution { status: number | null; stdout: string; stderr: string; error?: unknown }
export type DiagnosticRunner = (argv: string[], cwd: string, timeoutSeconds: number) => DiagnosticExecution;
export const diagnosticRunner: DiagnosticRunner = (argv, cwd, timeoutSeconds) => {
  const result = spawnSync(argv[0], argv.slice(1), { cwd, encoding: 'utf8', timeout: timeoutSeconds * 1000, maxBuffer: 256 * 1024, shell: false,
    env: { ...process.env, AWS_PAGER: '', AZURE_CORE_ONLY_SHOW_ERRORS: 'true', GH_PROMPT_DISABLED: '1', CLOUDSDK_CORE_DISABLE_PROMPTS: '1' } });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error };
};
export function harnessDoctor(root: string, options: { record?: unknown; run?: string[]; at?: string; runner?: DiagnosticRunner } = {}) {
  root = resolvePath(root);
  const spec = readJson(within(root, HARNESS_SPEC)); validateHarnessSpec(spec);
  const artifacts = checkHarness(root, true);
  const localFile = within(root, '.harness/workspace.local.json');
  const fingerprint = () => {
    const local = stat(localFile) ? readJson(localFile) : {};
    return hash(json({ root, receipt: fileHash(within(root, HARNESS_RECEIPT)), checkouts: isObject(local) ? local.checkouts : null }));
  };
  const binding = fingerprint();
  const checks: VerificationCheck[] = spec.targets.map(target => ({ id: `harness-agent-${target}`, layer: 'agent', target: { environment: 'local', identity: target }, criterion: spec.layout === 'centralized'
    ? 'The target session loaded AGENTS.md through its entry point and followed a linked procedure; native Skill, command and agent registration is not configured'
    : 'The current trusted host session discovered the generated entry points, selected skills and agents; cite a session observation' }));
  if (spec.hooks) for (const target of spec.targets) checks.push({ id: `harness-hook-${target}`, layer: 'hook', target: { environment: 'local', identity: target }, criterion: 'The current host invoked its configured hook; harmless positive and negative session probes produced the expected result' });
  checks.push(...spec.verification?.checks ?? []);
  for (const layer of ['tool', 'smoke']) if (!checks.some(check => check.layer === layer)) checks.push({ id: `harness-${layer}`, layer, target: { environment: 'local', identity: 'workspace' }, criterion: layer === 'tool' ? 'Record the project-required tool versions' : 'Define and run the first application smoke against its observed target and artifact' });
  if (spec.ci && !checks.some(check => check.layer === 'ci')) checks.push({ id: 'harness-ci', layer: 'ci', target: { environment: 'ci', identity: 'github-actions' }, criterion: 'Cite the actual required CI run and its result for this configuration' });
  const manifest = readJson(within(root, '.harness/workspace.json'), {});
  if (isObject(manifest) && isObject(manifest.onboarding) && Array.isArray(manifest.onboarding.platforms)) {
    for (const platform of manifest.onboarding.platforms) if (isObject(platform) && platform.access !== 'documentation-only' && !spec.verification?.checks.some(check => check.layer === 'access' && check.platform === platform.id)) {
      checks.push({ id: `harness-access-${platform.id}`, layer: 'access', target: { environment: 'configured-platform', identity: String(platform.id) }, criterion: 'Define a target-specific access probe and verify the selected account, subscription or project before use' });
    }
  }
  const record: VerificationRecord = options.record === undefined ? { schema_version: 1, observations: [] } : structuredClone(options.record) as VerificationRecord;
  validateVerificationRecord(record);
  const at = options.at ?? new Date().toISOString();
  const runIds = options.run ?? [];
  if (new Set(runIds).size !== runIds.length) throw new Error('Select each probe at most once');
  const selected: DiagnosticCheck[] = runIds.map(id => {
    const check = spec.verification?.checks.find(check => check.id === id);
    if (!check?.probe) throw new Error(`No declared executable probe: ${id}`);
    return check;
  });
  // Fail before spawning anything if the record or generated files are invalid.
  evaluateVerification(checks, record, binding, spec.verification?.max_age_seconds ?? 86400, at);
  if (selected.length && artifacts.status !== 'passed') throw new Error('Repair artifact/source drift before executing declared probes');
  const executions: Array<{ check: string; exit_code: number | null; stdout_sha256: string; stderr_sha256: string }> = [];
  for (const check of selected) {
    const probe = check.probe!;
    const base = probe.member ? path.dirname(sourcePath(root, { member: probe.member, path: '__harness_context__' })) : root;
    const cwd = probe.cwd ? within(base, probe.cwd) : base;
    const execution = (options.runner ?? diagnosticRunner)(probe.argv, cwd, probe.timeout_seconds);
    let matched = true;
    if (probe.expect_json) { try { matched = matchesJson(JSON.parse(execution.stdout), probe.expect_json); } catch { matched = false; } }
    const passed = !execution.error && execution.status === 0 && matched;
    const attempt = Math.max(0, ...record.observations.filter(item => item.check === check.id).map(item => item.attempt)) + 1;
    const observation: VerificationObservation = { check: check.id, attempt, binding, status: passed ? 'passed' : 'failed', target: check.target,
      ...(check.artifact ? { artifact: check.artifact } : {}), observed_at: options.at ?? new Date().toISOString(), method: 'probe',
      summary: passed ? 'Declared probe completed and its expected JSON assertions matched' : 'Probe failed, timed out or did not establish the expected JSON assertions',
      evidence: [`probe:${check.id}:stdout-sha256:${hash(execution.stdout)}`, `probe:${check.id}:exit:${execution.status ?? 'unavailable'}`] };
    record.observations.push(observation);
    executions.push({ check: check.id, exit_code: execution.status, stdout_sha256: hash(execution.stdout), stderr_sha256: hash(execution.stderr) });
  }
  const after = selected.length ? checkHarness(root, true) : artifacts;
  const evaluation = evaluateVerification(checks, record, binding, spec.verification?.max_age_seconds ?? 86400, options.at ?? new Date().toISOString());
  const configurationChanged = fingerprint() !== binding;
  const drift = after.status !== 'passed' || configurationChanged;
  return { ...evaluation, status: drift ? 'failed' : evaluation.status === 'failed' ? 'failed' : after.pending.length ? 'pending' : evaluation.status,
    artifacts: after, configuration_changed_during_probes: configurationChanged, executions, record, probes: (spec.verification?.checks ?? []).filter(check => check.probe).map(check => ({ id: check.id, target: check.target, criterion: check.criterion, ...check.probe })),
    evidence_note: 'Session attestations are supplied evidence, not independently authenticated host activation. Probe output hashes are retained; raw output is not.' };
}
