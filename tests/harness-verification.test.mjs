import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeHarnessPlan, applyHarnessPlan } from '../dist/harness.js';
import { checkHarness } from '../dist/harness-check.js';
import { harnessDoctor } from '../dist/harness-doctor.js';
import { harnessImpact, harnessSync } from '../dist/harness-impact.js';
import { makePlan, applyPlan } from '../dist/workspace.js';
import { evaluateVerification, validateHarnessSpec } from '../dist/index.js';
import { temporary, repo, writeJson, readJson, ROOT, AT, run } from './helpers.mjs';

function fixture(t) {
  const root = temporary(t), workspace = repo(root, 'workspace');
  const spec = { schema_version: 1, name: 'Verification fixture', targets: ['codex'], sources: [] };
  return { root, workspace, spec, apply() { applyHarnessPlan(makeHarnessPlan(workspace, spec)); } };
}
test('literal document commands validate package declarations, Make targets and script paths without execution', t => {
  const f = fixture(t);
  writeJson(path.join(f.workspace, 'package.json'), { scripts: { test: 'do-not-execute' } });
  fs.writeFileSync(path.join(f.workspace, 'Makefile'), 'check:\n\ttouch must-not-exist\n');
  fs.writeFileSync(path.join(f.workspace, 'smoke.mjs'), 'throw new Error("must not run");');
  f.spec.documents = [{ path: 'guide.md', body: '`npm run absent`\n`npm test`\n```sh\nmake check\nmake missing\nnode smoke.mjs\nnode missing.mjs\n```\n`npm run test --workspace member`\n`npm run ${SCRIPT}`' }]; f.apply();
  const report = checkHarness(f.workspace);
  assert.equal(report.status, 'failed');
  const rows = Object.fromEntries(report.commands.map(row => [row.command, row]));
  for (const command of ['npm run absent', 'make missing', 'node missing.mjs']) assert.equal(rows[command].status, 'failed');
  for (const command of ['npm test', 'make check', 'node smoke.mjs']) assert.equal(rows[command].status, 'passed');
  for (const command of ['npm run test --workspace member', 'npm run ${SCRIPT}']) assert.equal(rows[command].status, 'pending');
  assert.equal(fs.existsSync(path.join(f.workspace, 'must-not-exist')), false);
  fs.writeFileSync(path.join(f.workspace, 'Makefile'), 'include generated.mk\nvalue := $(shell touch must-not-exist)\n');
  assert.equal(checkHarness(f.workspace).commands.find(row => row.command === 'make missing').status, 'pending');
  assert.equal(fs.existsSync(path.join(f.workspace, 'must-not-exist')), false);
});
test('member command contexts resolve only selected local bindings and cannot escape their checkout', t => {
  const f = fixture(t), member = repo(f.root, 'api');
  fs.mkdirSync(path.join(member, 'app')); writeJson(path.join(member, 'app/package.json'), { scripts: { serve: 'application' } });
  applyPlan(makePlan(f.workspace, [['api', 'analyze', member]], null, []));
  f.spec.documents = [{ path: 'guide.md', body: '`npm run serve`' }];
  f.spec.command_checks = [{ document: 'guide.md', command: 'npm run serve', member: 'api', cwd: 'app' }]; f.apply();
  assert.equal(checkHarness(f.workspace).commands.find(row => row.command === 'npm run serve').status, 'pending');
  assert.equal(checkHarness(f.workspace, true).status, 'passed');
  fs.rmSync(path.join(member, 'app'), { recursive: true }); fs.symlinkSync(f.workspace, path.join(member, 'app'));
  assert.equal(checkHarness(f.workspace, true).status, 'failed');
});
test('source impact is precise for mapped outputs and conservative elsewhere; sync never writes members', t => {
  const f = fixture(t), member = repo(f.root, 'api');
  applyPlan(makePlan(f.workspace, [['api', 'register', member]], null, []));
  fs.writeFileSync(path.join(f.workspace, 'source-a.md'), 'a'); fs.writeFileSync(path.join(f.workspace, 'source-b.md'), 'b');
  fs.writeFileSync(path.join(member, 'copy.md'), 'a');
  f.spec.sources = [{ path: 'source-a.md' }, { path: 'source-b.md' }];
  f.spec.documents = [{ path: 'guide-a.md', body: 'A' }, { path: 'guide-b.md', body: 'B' }];
  f.spec.provenance = [{ output: 'guide-a.md', sources: [f.spec.sources[0]] }, { output: 'guide-b.md', sources: [f.spec.sources[1]] }];
  f.spec.projections = [{ source: f.spec.sources[0], target: { member: 'api', path: 'copy.md' } }]; f.apply();
  assert.equal(harnessSync(f.workspace).status, 'pending'); assert.equal(harnessSync(f.workspace, true).status, 'passed');
  fs.writeFileSync(path.join(f.workspace, 'source-a.md'), 'a2');
  const impact = harnessImpact(f.workspace, true);
  assert.ok(impact.affected.some(row => row.output === 'guide-a.md' && row.dependency_scope === 'explicit'));
  assert.ok(!impact.affected.some(row => row.output === 'guide-b.md'));
  assert.ok(impact.affected.some(row => row.output === 'AGENTS.md' && row.dependency_scope === 'conservative'));
  assert.equal(harnessSync(f.workspace, true).status, 'failed');
  assert.equal(fs.readFileSync(path.join(member, 'copy.md'), 'utf8'), 'a');
  assert.ok(!JSON.stringify(impact).includes(f.root));
});
function setupDoctor(f) {
  const target = { environment: 'local', identity: 'greeting' };
  const artifact = { kind: 'package_version', value: '1.0.0' };
  f.spec.verification = { max_age_seconds: 60, checks: [
    { id: 'node-version', layer: 'tool', target: { environment: 'local', identity: 'node' }, criterion: 'Node runs', probe: { argv: [process.execPath, '--version'], timeout_seconds: 5 } },
    { id: 'greeting-smoke', layer: 'smoke', target, artifact, criterion: 'Greeting accepted by the intended application version',
      probe: { argv: [process.execPath, 'smoke.mjs'], timeout_seconds: 5, expect_json: { target, artifact, accepted: true } } }
  ] };
  fs.writeFileSync(path.join(f.workspace, 'smoke.mjs'), `console.log(JSON.stringify(${JSON.stringify({ target, artifact, accepted: true })}));\n`);
  f.spec.sources = [{ path: 'smoke.mjs' }]; f.apply();
}
test('doctor executes only selected probes, binds target/artifact and leaves actual host activation pending', t => {
  const f = fixture(t); setupDoctor(f);
  const initial = harnessDoctor(f.workspace, { at: AT, runner() { throw new Error('No probe should run'); } });
  assert.equal(initial.status, 'pending'); assert.equal(initial.executions.length, 0);
  const report = harnessDoctor(f.workspace, { at: AT, run: ['node-version', 'greeting-smoke'] });
  assert.equal(report.status, 'pending');
  assert.equal(report.checks.find(row => row.id === 'greeting-smoke').status, 'passed');
  assert.equal(report.checks.find(row => row.layer === 'agent').status, 'pending');
  assert.equal(report.executions.length, 2);
  assert.throws(() => harnessDoctor(f.workspace, { run: ['unknown'] }), /No declared/);
  assert.throws(() => harnessDoctor(f.workspace, { run: ['harness-agent-codex'] }), /No declared/);
  const file = path.join(f.root, 'doctor.json'); writeJson(file, report);
  const cli = path.join(ROOT, 'skills/harness-init/scripts/harness.mjs');
  assert.equal(JSON.parse(run(cli, ['doctor', '--workspace', f.workspace, '--record', file, '--at', AT], { code: 2 }).stdout).executions.length, 0);
});
test('doctor rejects wrong identity, retains failed retries, redacts streams and expires stale or different configuration evidence', t => {
  const f = fixture(t); setupDoctor(f);
  const bad = harnessDoctor(f.workspace, { at: AT, run: ['greeting-smoke'], runner: () => ({ status: 0, stdout: '{"target":{"environment":"production","identity":"wrong"},"secret":"do-not-print"}', stderr: 'private diagnostic detail' }) });
  assert.equal(bad.status, 'failed'); assert.ok(!JSON.stringify(bad).includes('do-not-print')); assert.ok(!JSON.stringify(bad).includes('private diagnostic detail'));
  const recovered = harnessDoctor(f.workspace, { at: AT, record: bad.record, run: ['greeting-smoke'] });
  const smoke = recovered.checks.find(row => row.id === 'greeting-smoke'); assert.equal(smoke.recovered, true); assert.equal(smoke.history.length, 2);
  assert.equal(harnessDoctor(f.workspace, { at: '2026-01-01T12:01:01Z', record: recovered.record }).checks.find(row => row.id === 'greeting-smoke').status, 'pending');
  f.spec.name = 'Changed configuration'; f.apply();
  assert.match(harnessDoctor(f.workspace, { at: AT, record: recovered.record }).checks.find(row => row.id === 'greeting-smoke').reason, /another configuration/);
  fs.appendFileSync(path.join(f.workspace, 'smoke.mjs'), '// changed');
  assert.throws(() => harnessDoctor(f.workspace, { run: ['greeting-smoke'], runner() { throw new Error('Must not execute'); } }), /Repair artifact/);
});
test('native hooks cannot pass from a direct process result and diagnostic specs require identity assertions', t => {
  const f = fixture(t), sample = readJson(path.join(ROOT, 'skills/harness-init/assets/harness-complete.json'));
  f.spec.hooks = sample.hooks; setupDoctor(f);
  const report = harnessDoctor(f.workspace, { at: AT });
  const row = report.checks.find(row => row.layer === 'hook');
  const record = { schema_version: 1, observations: [{ check: row.id, attempt: 1, binding: report.binding, status: 'passed', target: row.target, observed_at: AT, summary: 'Direct hook script passed', method: 'probe', evidence: ['fixture:direct-process'] }] };
  assert.equal(harnessDoctor(f.workspace, { at: AT, record }).checks.find(row => row.layer === 'hook').status, 'pending');
  const invalid = structuredClone(f.spec); delete invalid.verification.checks[1].probe.expect_json.target;
  assert.throws(() => validateHarnessSpec(invalid), /observed target/);
  invalid.verification.checks[1].layer = 'agent'; assert.throws(() => validateHarnessSpec(invalid), /session attestations/);
});
test('CI command declarations use their own working directory and reject missing scripts', t => {
  const f = fixture(t); fs.mkdirSync(path.join(f.workspace, 'app'));
  writeJson(path.join(f.workspace, 'app/package.json'), { scripts: { check: 'fixture' } });
  f.spec.ci = { provider: 'github-actions', checks: [{ name: 'Application checks', run: 'npm run check', working_directory: 'app' }] }; f.apply();
  assert.equal(checkHarness(f.workspace).status, 'passed');
  writeJson(path.join(f.workspace, 'app/package.json'), { scripts: {} });
  assert.equal(checkHarness(f.workspace).status, 'failed');
});
test('verification cannot erase a reported failure for missing artifact or accept an empty scope', () => {
  const target = { environment: 'local', identity: 'fixture' }, binding = 'a'.repeat(64);
  const checks = [{ id: 'smoke', layer: 'smoke', target, criterion: 'Fixture accepted', artifact: { kind: 'package_version', value: '1.0.0' } }];
  const record = { schema_version: 1, observations: [{ check: 'smoke', attempt: 1, binding, status: 'failed', target, observed_at: AT, summary: 'Application rejected the input', evidence: ['fixture:failed'], method: 'attestation' }] };
  assert.equal(evaluateVerification(checks, record, binding, 60, AT).status, 'failed');
  assert.throws(() => evaluateVerification([], { schema_version: 1, observations: [] }, binding, 60, AT), /nonempty/);
});
