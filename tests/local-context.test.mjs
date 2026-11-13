import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseLocalContext, renderLocalContext, validateHarnessSpec } from '../dist/index.js';
import { readLocalContext, localBindingFingerprint, memberBinding, MissingLocalContext } from '../dist/local-context.js';
import { makePlan, applyPlan, checkWorkspace } from '../dist/workspace.js';
import { makeHarnessPlan, applyHarnessPlan } from '../dist/harness.js';
import { checkHarness } from '../dist/harness-check.js';
import { harnessDoctor } from '../dist/harness-doctor.js';
import { ROOT, temporary, repo, git, readJson, writeJson, run } from './helpers.mjs';

function fixture(t) {
  const base = temporary(t), root = repo(base, 'hub'), service = repo(base, 'api', 'https://example.test/api.git');
  fs.writeFileSync(path.join(service, 'README.md'), '# API\n\nSynthetic source.\n');
  const selection = ['api', 'analyze', service];
  applyPlan(makePlan(root, [selection]));
  const file = path.join(root, '.harness/docs/workspace.local.md');
  const data = () => parseLocalContext(fs.readFileSync(file, 'utf8'));
  return { base, root, service, selection, file, data };
}
function central(source = []) {
  return { schema_version: 1, name: 'Synthetic workspace', language: 'en', layout: 'centralized', targets: ['codex', 'claude-code'],
    sources: source, documents: [{ path: '.harness/docs/index.md', body: '# Tasks\n\nRead the selected sources; business execution remains unverified.' }] };
}
test('local block is bounded, strict, nonexecuting and preserves handwritten prose', () => {
  const prose = '# Personal context\n\nKeep this note and `$(do-not-execute)` unchanged.\n';
  const once = renderLocalContext(prose, { schema_version: 1, checkouts: {}, environment: { port: 8100 } });
  const twice = renderLocalContext(once, { schema_version: 1, checkouts: {}, environment: { port: 8200 } });
  assert.ok(twice.startsWith(prose)); assert.equal(parseLocalContext(twice).environment.port, 8200);
  assert.equal(renderLocalContext(twice, parseLocalContext(twice)), twice);
  assert.throws(() => parseLocalContext(once + once), /repeated/);
  assert.throws(() => parseLocalContext(once.replace('```json', '```sh')), /JSON fenced/);
  assert.throws(() => parseLocalContext(once.replace('"schema_version": 1', '"schema_version": 2')), /schema.version/);
  assert.throws(() => parseLocalContext('x'.repeat(1024 * 1024 + 1)), /limit/);
});
test('new local context is private and absent from shared sources, receipts and document inventories', t => {
  const f = fixture(t), shared = readJson(path.join(f.root, '.harness/workspace.json'));
  assert.equal(shared.local_context, '.harness/docs/workspace.local.md');
  assert.ok(!JSON.stringify(shared).includes(f.base));
  assert.equal(git(f.root, 'check-ignore', '.harness/docs/workspace.local.md'), '.harness/docs/workspace.local.md');
  assert.equal(fs.statSync(f.file).mode & 0o777, 0o600);
  const plan = makePlan(f.root, [['hub', 'init', f.root]]);
  assert.ok(!plan.analysis.hub.some(item => item.path.endsWith('.local.md')));
  assert.ok(!plan.document_consolidation.hub.documents.some(item => item.path.endsWith('.local.md')));
  assert.throws(() => makePlan(f.root, [['hub', 'init', f.root]], null, [], { reviews: [['hub', '.harness/docs/workspace.local.md']] }), /Local context/);
  assert.throws(() => makePlan(f.root, [['hub', 'init', f.root]], null, [], { sourceFiles: [['hub', '.harness/docs/workspace.local.md']] }), /Local context/);
  assert.throws(() => validateHarnessSpec(central([{ path: '.harness/docs/workspace.local.md' }])), /Local context/);
  const spec = central([{ member: 'api', path: 'README.md' }]);
  applyHarnessPlan(makeHarnessPlan(f.root, spec));
  assert.ok(!fs.readFileSync(path.join(f.root, '.harness/generated.json'), 'utf8').includes(f.base));
});
test('new checkout without local state passes shared detached checks and exposes missing local bindings', t => {
  const f = fixture(t); applyHarnessPlan(makeHarnessPlan(f.root, central([{ member: 'api', path: 'README.md' }])));
  fs.unlinkSync(f.file);
  assert.equal(checkHarness(f.root).status, 'passed');
  const local = checkHarness(f.root, true);
  assert.equal(local.status, 'passed'); assert.ok(local.pending.some(item => item.includes('Missing local')));
  assert.ok(checkWorkspace(f.root, true).warnings.some(item => item.includes('Missing local')));
  const detached = JSON.parse(run(path.join(f.root, '.harness/runtime/check.mjs'), ['--workspace', f.root]).stdout);
  assert.equal(detached.status, 'passed');
  const report = JSON.parse(run(path.join(ROOT, 'skills/harness-guide/scripts/local-context.mjs'), ['--workspace', f.root], { code: 2, cwd: f.service }).stdout);
  assert.equal(report.status, 'pending'); assert.deepEqual(report.missing, ['api']);
});
test('legacy JSON migrates once into existing AGENTS.local.md, retaining notes, state and a recovery copy', t => {
  const f = fixture(t), local = f.data(); fs.unlinkSync(f.file);
  const manifestFile = path.join(f.root, '.harness/workspace.json'), manifest = readJson(manifestFile);
  delete manifest.local_context; writeJson(manifestFile, manifest);
  const entry = path.join(f.root, 'AGENTS.local.md'), legacy = path.join(f.root, '.harness/workspace.local.json');
  fs.writeFileSync(entry, '# My machine\n\nKeep my context.\n');
  local.onboarding_status = { installation: { status: 'pending' } }; local.custom_observation = { retained: true };
  writeJson(legacy, local);
  const plan = makePlan(f.root);
  assert.equal(plan.local_context.path, 'AGENTS.local.md'); assert.equal(plan.local_context.migration, true);
  applyPlan(plan);
  assert.equal(fs.readFileSync(path.join(f.root, plan.local_context.markdown_backup), 'utf8'), '# My machine\n\nKeep my context.\n');
  assert.ok(fs.readFileSync(entry, 'utf8').startsWith('# My machine\n\nKeep my context.\n'));
  const migrated = parseLocalContext(fs.readFileSync(entry, 'utf8'));
  assert.deepEqual(migrated.onboarding_status, local.onboarding_status);
  assert.deepEqual(migrated.state.legacy_fields.custom_observation, { retained: true });
  assert.equal(fs.existsSync(legacy), false); assert.deepEqual(readJson(path.join(f.root, plan.local_context.backup)), local);
  assert.deepEqual(applyPlan(makePlan(f.root)).written, []);
});
test('Markdown/JSON conflicts and corrupt blocks never silently fall back or overwrite prose', t => {
  const f = fixture(t), legacy = path.join(f.root, '.harness/workspace.local.json'), data = f.data();
  data.environment = { port: 8001 }; writeJson(legacy, data);
  fs.writeFileSync(f.file, renderLocalContext(fs.readFileSync(f.file, 'utf8'), { ...f.data(), environment: { port: 8002 } }));
  assert.throws(() => makePlan(f.root), /Conflicting.*environment.port/);
  const before = fs.readFileSync(f.file, 'utf8'); fs.writeFileSync(f.file, before.replace('```json', '```shell'));
  assert.throws(() => readLocalContext(f.root), /JSON fenced/);
  assert.ok(fs.existsSync(legacy));
});
test('tracked local Markdown and overridden ignore rules block writes', t => {
  const f = fixture(t); git(f.root, 'add', '-f', '.harness/docs/workspace.local.md');
  assert.throws(() => makePlan(f.root), /Untrack/);
  git(f.root, 'rm', '--cached', '.harness/docs/workspace.local.md');
  fs.writeFileSync(path.join(f.root, '.harness/docs/.gitignore'), '!workspace.local.md\n');
  assert.throws(() => applyPlan(makePlan(f.root)), /does not ignore/);
});
test('notes leave doctor binding unchanged, while environment changes invalidate observations', t => {
  const f = fixture(t); applyHarnessPlan(makeHarnessPlan(f.root, central()));
  const before = localBindingFingerprint(f.root), doctor = harnessDoctor(f.root);
  fs.appendFileSync(f.file, '\nHandwritten note with no environment change.\n');
  assert.equal(localBindingFingerprint(f.root), before); assert.equal(harnessDoctor(f.root).binding, doctor.binding);
  const patch = path.join(f.base, 'patch.json'); writeJson(patch, { environment: { port: 8765 }, execution: { first: { status: 'failed' } } });
  run(path.join(ROOT, 'skills/harness-test/scripts/local-context.mjs'), ['--workspace', f.root, '--patch', patch], { cwd: f.service });
  assert.notEqual(localBindingFingerprint(f.root), before);
  assert.notEqual(harnessDoctor(f.root).binding, doctor.binding);
  writeJson(patch, { execution: { second: { status: 'passed' } } });
  run(path.join(ROOT, 'skills/harness-test/scripts/local-context.mjs'), ['--workspace', f.root, '--patch', patch]);
  assert.deepEqual(Object.keys(f.data().execution), ['first', 'second']);
  assert.ok(fs.readFileSync(f.file, 'utf8').endsWith('Handwritten note with no environment change.\n'));
});
test('foreign-machine context cannot establish bindings or inherit access readiness', t => {
  const f = fixture(t), data = f.data(); data.machine = '0'.repeat(64); data.access = { login: { status: 'passed' } };
  fs.writeFileSync(f.file, renderLocalContext('', data));
  assert.throws(() => memberBinding(f.root, 'api'), MissingLocalContext);
  applyPlan(makePlan(f.root, [f.selection]));
  assert.deepEqual(f.data().access, {}); assert.equal(f.data().execution.status, 'pending');
  assert.equal(f.data().state.previous_machine_state.access.login.status, 'passed');
});
test('relative bindings resolve from the workspace regardless of invocation cwd and enforce remote identity', t => {
  const f = fixture(t), data = f.data();
  data.checkouts.api.path = '../api'; data.checkouts.api.git_common_dir = '../api/.git';
  fs.writeFileSync(f.file, renderLocalContext('', data));
  const report = JSON.parse(run(path.join(ROOT, 'skills/harness-setup-local/scripts/local-context.mjs'), ['--workspace', f.root], { cwd: f.service }).stdout);
  assert.equal(report.data.checkouts.api.path, f.service);
  git(f.service, 'remote', 'set-url', 'origin', 'https://example.test/different.git');
  assert.throws(() => memberBinding(f.root, 'api'), /identity differs/);
});
test('centralized layout can explicitly select detached CI while settings and hooks remain native', t => {
  const f = fixture(t), spec = central(); spec.ci = { provider: 'github-actions', checks: [] };
  applyHarnessPlan(makeHarnessPlan(f.root, spec));
  assert.ok(fs.existsSync(path.join(f.root, '.github/workflows/harness-gate.yml')));
  assert.equal(checkHarness(f.root).status, 'passed');
  assert.equal(checkHarness(f.root).ci_execution, 'not run');
  assert.throws(() => validateHarnessSpec({ ...spec, settings: {} }), /native settings/);
});
test('failed migration restores Markdown, legacy input and ignore files without losing a later retry', t => {
  const f = fixture(t), data = f.data(), legacy = path.join(f.root, '.harness/workspace.local.json');
  writeJson(legacy, data);
  const before = fs.readFileSync(f.file), manifest = fs.readFileSync(path.join(f.root, '.harness/workspace.json'));
  const rename = fs.renameSync;
  const stub = t.mock.method(fs, 'renameSync', (source, target) => {
    if (path.basename(target) === 'workspace.json') throw new Error('Synthetic migration failure');
    return rename(source, target);
  });
  // Force a real metadata write after the local file and recovery copy.
  data.environment = { port: 8931 }; writeJson(legacy, data);
  const options = { profile: { schema_version: 1, language: 'en', background: 'Synthetic migration profile' } };
  const fresh = makePlan(f.root, [], null, [], options);
  assert.throws(() => applyPlan(fresh), /Synthetic migration failure/);
  stub.mock.restore();
  assert.deepEqual(fs.readFileSync(f.file), before); assert.deepEqual(fs.readFileSync(path.join(f.root, '.harness/workspace.json')), manifest);
  assert.deepEqual(readJson(legacy), data);
  applyPlan(makePlan(f.root, [], null, [], options)); assert.equal(fs.existsSync(legacy), false);
  assert.ok(fs.existsSync(path.join(f.root, fresh.local_context.backup)));
});
test('handwritten local notes can change between generation preview and apply without invalidating the binding', t => {
  const f = fixture(t), plan = makeHarnessPlan(f.root, central());
  fs.appendFileSync(f.file, '\nPreserved personal note.\n');
  applyHarnessPlan(plan);
  assert.ok(fs.readFileSync(f.file, 'utf8').endsWith('Preserved personal note.\n'));
});
test('two machines can use different paths, ports and profiles with identical shared artifacts', t => {
  const a = fixture(t), b = fixture(t);
  for (const [f, port, profile] of [[a, 8101, 'profile-a'], [b, 8202, 'profile-b']]) {
    const patch = path.join(f.base, 'context-patch.json'); writeJson(patch, { environment: { port }, access: { cli_profile: profile } });
    run(path.join(ROOT, 'skills/harness-init/scripts/local-context.mjs'), ['--workspace', f.root, '--patch', patch]);
    applyHarnessPlan(makeHarnessPlan(f.root, central([{ member: 'api', path: 'README.md' }])));
  }
  assert.deepEqual(readJson(path.join(a.root, '.harness/workspace.json')), readJson(path.join(b.root, '.harness/workspace.json')));
  assert.deepEqual(readJson(path.join(a.root, '.harness/generated.json')), readJson(path.join(b.root, '.harness/generated.json')));
  assert.notEqual(localBindingFingerprint(a.root), localBindingFingerprint(b.root));
  assert.equal(a.data().environment.port, 8101); assert.equal(b.data().access.cli_profile, 'profile-b');
});
test('legacy-only reads are compatible but do not create another writer or permit a second Markdown authority', t => {
  const f = fixture(t), legacy = path.join(f.root, '.harness/workspace.local.json');
  assert.throws(() => makePlan(f.root, [], null, [], { local_context: 'AGENTS.local.md' }), /another authority/);
  writeJson(legacy, f.data()); fs.unlinkSync(f.file);
  assert.equal(readLocalContext(f.root).format, 'legacy-json');
  assert.equal(memberBinding(f.root, 'api').path, f.service);
  assert.equal(fs.existsSync(f.file), false);
});
test('a retargeted local parent cannot write outside the selected workspace', t => {
  const f = fixture(t), plan = makePlan(f.root, [], null, [], { local_patch: { environment: { port: 8991 } } });
  const outside = path.join(f.base, 'outside'); fs.mkdirSync(outside);
  const sentinel = path.join(outside, 'workspace.local.md'); fs.writeFileSync(sentinel, 'Do not change');
  const state = path.join(f.root, '.harness/docs');
  // A concurrent retarget after preview must be rejected before writing any local data.
  fs.renameSync(state, state + '-original'); fs.symlinkSync(outside, state);
  assert.throws(() => applyPlan(plan), /escapes/);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'Do not change');
});

test('an oversized local patch is rejected during preview and preserves existing context', t => {
  const f = fixture(t), before = fs.readFileSync(f.file);
  assert.throws(() => makePlan(f.root, [], null, [], { local_patch: { state: { raw_log: 'x'.repeat(1024 * 1024) } } }), /limit/);
  assert.deepEqual(fs.readFileSync(f.file), before);
});

test('changing the checked-out revision invalidates local execution binding even for unchanged declared files', t => {
  const f = fixture(t), before = localBindingFingerprint(f.root);
  git(f.service, 'add', 'README.md');
  git(f.service, '-c', 'user.name=Synthetic Fixture', '-c', 'user.email=fixture@example.test', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Synthetic revision');
  assert.notEqual(localBindingFingerprint(f.root), before);
});
test('an unavailable checkout is pending without blocking independent member lookup', t => {
  const f = fixture(t), data = f.data();
  data.checkouts.api.path = path.join(f.base, 'not-present');
  fs.writeFileSync(f.file, renderLocalContext('', data));
  assert.throws(() => memberBinding(f.root, 'api'), MissingLocalContext);
  const report = JSON.parse(run(path.join(ROOT, 'skills/harness-guide/scripts/local-context.mjs'), ['--workspace', f.root], { code: 2 }).stdout);
  assert.deepEqual(report.errors, []); assert.deepEqual(report.missing, ['api']);
});

test('legacy retirement waits for generated consumers to use the Markdown runtime', t => {
  const f = fixture(t), legacy = path.join(f.root, '.harness/workspace.local.json');
  writeJson(legacy, f.data()); fs.unlinkSync(f.file);
  const receipt = path.join(f.root, '.harness/generated.json'); writeJson(receipt, { schema_version: 1, files: [] });
  assert.throws(() => makePlan(f.root), /Refresh generated local-context consumers/);
  assert.ok(fs.existsSync(legacy)); assert.equal(fs.existsSync(f.file), false);
  fs.unlinkSync(receipt);
  // The new generator can read legacy JSON while updating its detached consumers first.
  applyHarnessPlan(makeHarnessPlan(f.root, central([{ member: 'api', path: 'README.md' }])));
  applyPlan(makePlan(f.root));
  assert.equal(fs.existsSync(legacy), false); assert.equal(checkHarness(f.root, true).status, 'passed');
});

test('declared project locators must switch from the JSON map before legacy retirement', t => {
  const f = fixture(t), legacy = path.join(f.root, '.harness/workspace.local.json'), spec = central();
  writeJson(legacy, f.data()); fs.unlinkSync(f.file);
  spec.resources = [{ path: '.harness/resources/project.mjs', body: 'import fs from "node:fs"; console.log(JSON.parse(fs.readFileSync(process.argv[2]+"/.harness/workspace.local.json", "utf8")));' }];
  applyHarnessPlan(makeHarnessPlan(f.root, spec));
  assert.throws(() => makePlan(f.root), /legacy locator resource/);
  assert.ok(fs.existsSync(legacy));
  spec.resources[0].body = 'import {execFileSync} from "node:child_process"; import {fileURLToPath} from "node:url"; process.stdout.write(execFileSync(process.execPath, [fileURLToPath(new URL("../runtime/local-context.mjs", import.meta.url)), "--workspace", process.argv[2]], {encoding:"utf8"}));';
  applyHarnessPlan(makeHarnessPlan(f.root, spec));
  applyPlan(makePlan(f.root));
  const located = JSON.parse(run(path.join(f.root, '.harness/resources/project.mjs'), [f.root], { cwd: f.service }).stdout);
  assert.equal(located.data.checkouts.api.path, f.service);
});

test('repeated machine changes retain earlier failed observations in local history', t => {
  const f = fixture(t);
  for (const machine of ['1'.repeat(64), '2'.repeat(64)]) {
    const data = f.data(); data.machine = machine; data.execution = { attempt: { status: 'failed', machine } };
    fs.writeFileSync(f.file, renderLocalContext('', data));
    applyPlan(makePlan(f.root, [f.selection]));
  }
  const history = Object.values(f.data().state.machine_history);
  assert.equal(history.length, 2);
  assert.ok(history.every(snapshot => snapshot.execution.attempt.status === 'failed'));
});
