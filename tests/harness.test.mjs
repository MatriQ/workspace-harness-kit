import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse as parseToml } from 'smol-toml';
import { validateHarnessSpec, renderHarness, evaluateGuard, planOnboarding } from '../dist/index.js';
import { makeHarnessPlan, applyHarnessPlan } from '../dist/harness.js';
import { checkHarness } from '../dist/harness-check.js';
import { makePlan, applyPlan } from '../dist/workspace.js';
import { ROOT, temporary, repo, readJson, writeJson, run } from './helpers.mjs';

const CLI = path.join(ROOT, 'skills/harness-init/scripts/harness.mjs');
const sample = () => readJson(path.join(ROOT, 'skills/harness-init/assets/harness-complete.json'));
function fixture(t) {
  const root = temporary(t), directory = repo(root, 'coordinator');
  fs.writeFileSync(path.join(directory, 'README.md'), '# Greeting services\n\nAn API, client and worker form a synthetic greeting journey. Hosted deployment is not configured. Shared-history rewrites are excluded by this synthetic team.\n');
  return { root, directory, spec: sample(), read: name => fs.readFileSync(path.join(directory, name), 'utf8') };
}
function generate(f) {
  const plan = makeHarnessPlan(f.directory, f.spec); assert.deepEqual(plan.conflicts, []);
  applyHarnessPlan(plan); return plan;
}
function hook(f, input, cwd = f.directory) {
  const result = spawnSync(process.execPath, [path.join(f.directory, '.harness/runtime/hook.mjs')], { cwd, input: JSON.stringify(input), encoding: 'utf8', timeout: 10000 });
  assert.ifError(result.error); assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout);
}

function centralizedSpec() {
  return { schema_version: 1, name: 'Synthetic centralized workspace', layout: 'centralized', targets: ['codex', 'claude-code'], sources: [],
    documents: [{ path: '.harness/docs/index.md', body: '# Project guide\n\nRead the implementation before editing.\n' }],
    skills: [{ name: 'inspect', description: 'Inspect the project', body: 'Read the project sources.' }],
    commands: [{ name: 'verify', description: 'Verify a change', body: 'Select the relevant tests.' }],
    agents: [{ name: 'reader', description: 'Trace an implementation', body: 'Return concrete references.' }],
    rules: [{ name: 'evidence', body: 'Report actual execution results.' }] };
}

test('centralized layout owns one directory and one canonical entry point with a real alias', t => {
  const f = fixture(t); f.spec = centralizedSpec();
  const plan = generate(f);
  assert.ok(plan.files.every(file => file.path.startsWith('.harness/') || ['AGENTS.md', 'CLAUDE.md'].includes(file.path)));
  assert.equal(fs.lstatSync(path.join(f.directory, 'AGENTS.md')).isSymbolicLink(), false);
  assert.equal(fs.readlinkSync(path.join(f.directory, 'CLAUDE.md')), 'AGENTS.md');
  assert.equal(f.read('CLAUDE.md'), f.read('AGENTS.md'));
  for (const dir of ['.codex', '.agents', '.claude', 'docs', 'skills']) assert.equal(fs.existsSync(path.join(f.directory, dir)), false);
  let checked = checkHarness(f.directory, true);
  assert.equal(checked.status, 'passed', JSON.stringify(checked));
  assert.equal(checked.configuration.discovery, 'entrypoint-routed');
  assert.ok(checked.activation.every(item => item.next_action.includes('native Skill/command/agent registration is not configured')));
  assert.deepEqual(applyHarnessPlan(makeHarnessPlan(f.directory, f.spec)).written, []);
  fs.unlinkSync(path.join(f.directory, 'CLAUDE.md'));
  fs.writeFileSync(path.join(f.directory, 'CLAUDE.md'), f.read('AGENTS.md'));
  checked = checkHarness(f.directory);
  assert.ok(checked.errors.some(error => error.includes('symlink changed')));
});

test('centralized aliases preserve custom files until reconciliation and reject stale plans', t => {
  const f = fixture(t); f.spec = centralizedSpec();
  fs.writeFileSync(path.join(f.directory, 'CLAUDE.md'), 'Team instructions.\n');
  assert.ok(makeHarnessPlan(f.directory, f.spec).conflicts.some(file => file.path === 'CLAUDE.md'));
  const plan = makeHarnessPlan(f.directory, f.spec, { adopt: ['CLAUDE.md'] });
  fs.writeFileSync(path.join(f.directory, 'CLAUDE.md'), 'Concurrent instructions.\n');
  assert.throws(() => applyHarnessPlan(plan), /changed since preview/);
  assert.equal(f.read('CLAUDE.md'), 'Concurrent instructions.\n');
  applyHarnessPlan(makeHarnessPlan(f.directory, f.spec, { adopt: ['CLAUDE.md'] }));
  fs.unlinkSync(path.join(f.directory, 'CLAUDE.md'));
  fs.symlinkSync('README.md', path.join(f.directory, 'CLAUDE.md'));
  assert.ok(checkHarness(f.directory).errors.some(error => error.includes('symlink changed')));
  assert.ok(makeHarnessPlan(f.directory, f.spec).conflicts.some(file => file.path === 'CLAUDE.md'));
});

test('centralized alias creation rolls back without discarding original entry points', t => {
  const f = fixture(t); f.spec = centralizedSpec();
  fs.writeFileSync(path.join(f.directory, 'AGENTS.md'), 'Original canonical instructions.\n');
  fs.writeFileSync(path.join(f.directory, 'CLAUDE.md'), 'Reviewed alias replacement.\n');
  const plan = makeHarnessPlan(f.directory, f.spec, { adopt: ['CLAUDE.md'] }), rename = fs.renameSync;
  const mock = t.mock.method(fs, 'renameSync', (source, target) => { if (target.endsWith('/generated.json')) throw new Error('Synthetic receipt failure'); return rename(source, target); });
  assert.throws(() => applyHarnessPlan(plan), /Synthetic receipt failure/); mock.mock.restore();
  assert.equal(f.read('AGENTS.md'), 'Original canonical instructions.\n');
  assert.equal(f.read('CLAUDE.md'), 'Reviewed alias replacement.\n');
  assert.equal(fs.lstatSync(path.join(f.directory, 'CLAUDE.md')).isSymbolicLink(), false);
});

test('centralized selection confines output and distinguishes native integrations', t => {
  const f = fixture(t), spec = centralizedSpec();
  for (const patch of [{ documents: [{ path: 'docs/index.md', body: 'Outside the selected directory' }] },
    { resources: [{ path: '.harness/workspace.json', body: '{}' }] }, { settings: {} }]) {
    assert.throws(() => validateHarnessSpec({ ...spec, ...patch }), /Centralized/);
  }
  const profile = { schema_version: 1, harness: { layout: 'centralized', targets: spec.targets, artifacts: { documents: true } } };
  assert.equal(planOnboarding(profile).documents[0].path, '.harness/docs/index.md');
  assert.throws(() => planOnboarding({ ...profile, harness: { ...profile.harness, artifacts: { hooks: true } } }), /Centralized/);
  applyPlan(makePlan(f.directory, [], null, [], { profile }));
  assert.throws(() => makeHarnessPlan(f.directory, { ...spec, layout: 'native', documents: [{ path: 'docs/index.md', body: '# Native guide' }] }), /layout differs/);
});

test('full harness is previewable, generated for both hosts and idempotent', t => {
  const f = fixture(t), plan = makeHarnessPlan(f.directory, f.spec);
  assert.equal(fs.existsSync(path.join(f.directory, '.harness')), false);
  assert.deepEqual(plan.conflicts, []); assert.ok(plan.files.every(file => typeof file.content === 'string'));
  applyHarnessPlan(plan);
  const checked = checkHarness(f.directory, true);
  assert.equal(checked.status, 'passed', JSON.stringify(checked));
  assert.equal(checked.configuration.kind, 'repository-harness');
  assert.deepEqual(checked.configuration.targets.map(item => item.entrypoint), ['AGENTS.md', 'CLAUDE.md']);
  for (const files of Object.values(checked.configuration.parts)) {
    assert.ok(files.length > 0);
    for (const file of files) assert.ok(fs.existsSync(path.join(f.directory, file)), file);
  }
  assert.equal(checked.hook_cases.length, 4); assert.ok(checked.activation.every(item => item.status === 'not run'));
  assert.deepEqual(applyHarnessPlan(makeHarnessPlan(f.directory, f.spec)).written, []);
  const agent = parseToml(f.read('.codex/agents/reader.toml'));
  assert.equal(agent.name, 'reader'); assert.equal(agent.developer_instructions, f.spec.agents[0].body);
  assert.ok(!('sandbox_mode' in agent)); assert.ok(!('model' in agent));
  assert.equal(parseToml(f.read('.codex/config.toml')).sandbox_mode, 'workspace-write');
  assert.ok(fs.existsSync(path.join(f.directory, '.claude/commands/release-check.md')));
  assert.ok(fs.existsSync(path.join(f.directory, '.agents/skills/release-check/agents/openai.yaml')));
  assert.equal(f.read('.agents/skills/investigate/references/report.md'), f.spec.skills[0].resources[0].body);
});

test('a minimal new workspace generates only its chosen host and artifact scope', t => {
  const root = temporary(t);
  for (const target of ['codex', 'claude-code']) {
    const directory = path.join(root, target); fs.mkdirSync(directory);
    const spec = { schema_version: 1, name: 'New workspace', targets: [target], sources: [] };
    const plan = makeHarnessPlan(directory, spec); applyHarnessPlan(plan);
    const check = checkHarness(directory);
    assert.equal(check.status, 'passed');
    assert.equal(check.configuration.kind, 'entrypoints-only');
    assert.deepEqual(plan.files.map(file => file.kind).sort(), ['entrypoint', 'runtime', 'runtime', 'runtime', 'spec']);
    assert.equal(fs.existsSync(path.join(directory, target === 'codex' ? 'AGENTS.md' : 'CLAUDE.md')), true);
    for (const folder of ['.codex', '.claude', '.agents', '.github']) assert.equal(fs.existsSync(path.join(directory, folder)), false);
  }
});

test('selected settings must produce native files for the selected host', t => {
  const f = fixture(t);
  const spec = { schema_version: 1, name: 'Synthetic workspace', targets: ['codex'], sources: [], settings: { claude_code: { defaultMode: 'default' } } };
  const profile = { schema_version: 1, harness: { targets: ['codex'], artifacts: { settings: true } } };
  applyPlan(makePlan(f.directory, [], null, [], { profile }));
  assert.throws(() => makeHarnessPlan(f.directory, spec), /Claude settings require the claude-code target/);
  assert.throws(() => validateHarnessSpec({ ...spec, settings: {} }), /native configuration/);
  assert.throws(() => validateHarnessSpec({ ...spec, settings: { commands: [] } }), /native configuration/);
  delete spec.settings;
  spec.documents = [{ path: 'docs/index.md', body: '# Synthetic workspace\n\nLocal development instructions.\n' }];
  profile.harness.artifacts = { documents: true, settings: false };
  applyPlan(makePlan(f.directory, [], null, [], { profile }));
  applyHarnessPlan(makeHarnessPlan(f.directory, spec));
  assert.equal(checkHarness(f.directory).configuration.kind, 'documents-only');
});

test('Chinese entry points survive regeneration without translating authored content or handwritten rules', t => {
  const f = fixture(t);
  for (const file of ['AGENTS.md', 'CLAUDE.md']) fs.writeFileSync(path.join(f.directory, file), 'Existing team instructions.\n');
  generate(f);
  assert.ok(f.read('AGENTS.md').includes('Use the selected workspace'));
  f.spec.language = 'zh-CN'; f.spec.name = '问候服务工作区';
  generate(f);
  for (const file of ['AGENTS.md', 'CLAUDE.md']) {
    const text = f.read(file);
    assert.ok(text.startsWith('Existing team instructions.\n'));
    assert.ok(text.includes('在选定的工作区中遵循已有说明'));
    assert.ok(text.includes('操作步骤') && text.includes('沿用父级权限') && text.includes('必读规则'));
    assert.ok(text.includes('node .harness/runtime/check.mjs --workspace .'));
    assert.ok(!text.includes('Use the selected workspace'));
  }
  for (const doc of f.spec.documents) assert.equal(f.read(doc.path), doc.body.trim() + '\n');
  assert.equal(checkHarness(f.directory, true).status, 'passed');
  const saved = readJson(path.join(f.directory, '.harness/harness.json'));
  assert.equal(saved.language, 'zh-CN');
  assert.deepEqual(applyHarnessPlan(makeHarnessPlan(f.directory, saved)).written, []);
  for (const language of [null, 'zh_CN', 'fr']) assert.throws(() => validateHarnessSpec({ ...saved, language }), /entry-point language/);
});

test('shared .claude and AGENTS symlinks preserve their targets and handwritten configuration', t => {
  const f = fixture(t); fs.mkdirSync(path.join(f.directory, '.codex'));
  fs.symlinkSync('.codex', path.join(f.directory, '.claude'));
  fs.writeFileSync(path.join(f.directory, 'CLAUDE.md'), 'Handwritten project instructions.\n'); fs.symlinkSync('CLAUDE.md', path.join(f.directory, 'AGENTS.md'));
  writeJson(path.join(f.directory, '.codex/settings.json'), { permissions: { deny: ['Read(.env)'] }, env: { FIXTURE_MODE: 'local' } });
  fs.writeFileSync(path.join(f.directory, '.codex/config.toml'), '# Keep this runtime choice\nmodel = "synthetic-existing-model"\n\n[features]\nweb_search = false\n');
  const plan = generate(f);
  assert.equal(fs.readlinkSync(path.join(f.directory, '.claude')), '.codex');
  assert.equal(fs.readlinkSync(path.join(f.directory, 'AGENTS.md')), 'CLAUDE.md');
  assert.ok(f.read('CLAUDE.md').startsWith('Handwritten project instructions.\n'));
  assert.deepEqual(plan.files.find(file => file.path === 'CLAUDE.md').logical_paths, ['AGENTS.md', 'CLAUDE.md']);
  const settings = readJson(path.join(f.directory, '.codex/settings.json'));
  assert.ok(settings.permissions.deny.includes('Read(.env)')); assert.equal(settings.env.FIXTURE_MODE, 'local');
  assert.ok(f.read('.codex/config.toml').includes('# Keep this runtime choice\n'));
  assert.equal(parseToml(f.read('.codex/config.toml')).features.web_search, false);
  assert.equal(checkHarness(f.directory, true).status, 'passed');
});

test('refresh preserves manual entry-point additions but detects edits within its managed block', t => {
  const f = fixture(t); generate(f);
  fs.appendFileSync(path.join(f.directory, 'AGENTS.md'), '\nAdditional team convention.\n');
  assert.equal(checkHarness(f.directory).status, 'failed');
  generate(f); assert.ok(f.read('AGENTS.md').endsWith('Additional team convention.\n'));
  fs.writeFileSync(path.join(f.directory, 'AGENTS.md'), f.read('AGENTS.md').replace('# Greeting workspace', '# Edited managed block'));
  const plan = makeHarnessPlan(f.directory, f.spec);
  assert.ok(plan.conflicts.some(conflict => conflict.path === 'AGENTS.md'));
  assert.throws(() => applyHarnessPlan(plan), /conflicts/);
});

test('unowned and concurrently edited files remain intact until explicitly reconciled', t => {
  const f = fixture(t); fs.mkdirSync(path.join(f.directory, 'docs/harness'), { recursive: true });
  fs.writeFileSync(path.join(f.directory, 'docs/harness/overview.md'), 'Existing source of truth.\n');
  let plan = makeHarnessPlan(f.directory, f.spec);
  assert.ok(plan.conflicts.some(conflict => conflict.path === 'docs/harness/overview.md'));
  assert.throws(() => applyHarnessPlan(plan), /conflicts/);
  assert.equal(f.read('docs/harness/overview.md'), 'Existing source of truth.\n');
  f.spec.documents[0].body = 'Existing source of truth.\n\nReviewed addition.';
  plan = makeHarnessPlan(f.directory, f.spec, { adopt: ['docs/harness/overview.md'] });
  assert.deepEqual(plan.conflicts, []); applyHarnessPlan(plan);
  const stale = makeHarnessPlan(f.directory, f.spec);
  fs.appendFileSync(path.join(f.directory, '.claude/settings.json'), '\n');
  assert.throws(() => applyHarnessPlan(stale), /changed since preview/);
  assert.ok(f.read('.claude/settings.json').endsWith('\n\n'));
});

test('source changes invalidate a preview and are reported after generation', t => {
  const f = fixture(t), plan = makeHarnessPlan(f.directory, f.spec);
  fs.appendFileSync(path.join(f.directory, 'README.md'), 'New observed behavior.\n');
  assert.throws(() => applyHarnessPlan(plan), /changed since preview/);
  assert.equal(fs.existsSync(path.join(f.directory, '.harness')), false);
  generate(f); fs.appendFileSync(path.join(f.directory, 'README.md'), 'Another source change.\n');
  assert.ok(checkHarness(f.directory).errors.some(error => error.includes('Source changed')));
});

test('external source bindings remain local and initialization choices bind generated outputs', t => {
  const f = fixture(t), member = repo(f.root, 'api'); fs.writeFileSync(path.join(member, 'README.md'), 'API source.');
  const profile = { schema_version: 1, background: 'Synthetic team workspace', harness: {
    targets: ['codex', 'claude-code'], artifacts: Object.fromEntries(['documents', 'skills', 'commands', 'agents', 'rules', 'settings', 'hooks', 'ci'].map(part => [part, true])) } };
  applyPlan(makePlan(f.directory, [['api', 'analyze', member]], null, [], { profile }));
  f.spec.sources.push({ member: 'api', path: 'README.md' }); generate(f);
  assert.equal(checkHarness(f.directory, true).status, 'passed');
  assert.equal(checkHarness(f.directory).pending.length, 1);
  assert.ok(!f.read('.harness/generated.json').includes(f.root));
  profile.background = 'Updated scope'; applyPlan(makePlan(f.directory, [], null, [], { profile }));
  assert.ok(checkHarness(f.directory, true).errors.some(error => error.includes('Initialization choices changed')));
  profile.harness.artifacts.hooks = false; applyPlan(makePlan(f.directory, [], null, [], { profile }));
  assert.throws(() => makeHarnessPlan(f.directory, f.spec), /selected hooks scope/);
});

test('generated hooks process actual JSON stdin without granting unselected permission', t => {
  const f = fixture(t); generate(f);
  const nested = path.join(f.directory, 'nested/path'); fs.mkdirSync(nested, { recursive: true });
  for (const example of f.spec.hooks.cases) {
    const output = hook(f, example.input, nested);
    if (example.expected === 'deny') assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
    else assert.deepEqual(output, {});
  }
  const malformed = hook(f, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: {} });
  assert.equal(malformed.hookSpecificOutput.permissionDecision, 'deny');
  assert.deepEqual(evaluateGuard(f.spec.hooks.guards, { hook_event_name: 'PostToolUse', tool_name: 'Bash' }), { decision: 'pass' });
  const registration = readJson(path.join(f.directory, '.claude/settings.json')).hooks.PreToolUse[0].hooks[0];
  const nativeCommand = spawnSync('/bin/sh', ['-c', registration.command], { cwd: nested, input: JSON.stringify(f.spec.hooks.cases[1].input), encoding: 'utf8', timeout: 10000 });
  assert.equal(nativeCommand.status, 0, nativeCommand.stderr);
  assert.equal(JSON.parse(nativeCommand.stdout).hookSpecificOutput.permissionDecision, 'deny');
});

test('generated CI gate has explicit scope, runs detached, and fails on changed harness bytes', t => {
  const f = fixture(t); generate(f);
  const workflow = readJson(path.join(f.directory, '.github/workflows/harness-gate.yml'));
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(Object.keys(workflow.on).sort(), ['pull_request', 'push', 'workflow_call']);
  assert.equal(workflow.jobs.harness.steps[0].with['persist-credentials'], false);
  const checker = path.join(f.directory, '.harness/runtime/check.mjs');
  assert.equal(JSON.parse(run(checker, ['--workspace', f.directory], { cwd: f.root }).stdout).status, 'passed');
  fs.appendFileSync(path.join(f.directory, '.claude/rules/evidence.md'), '\nUnreviewed rule.\n');
  assert.equal(JSON.parse(run(checker, ['--workspace', f.directory], { cwd: f.root, code: 1 }).stdout).status, 'failed');
});

test('a broken derived link or missing receipt coverage cannot pass verification', t => {
  const f = fixture(t); f.spec.documents[0].body += '\n[Missing guide](missing.md)'; generate(f);
  assert.ok(checkHarness(f.directory).errors.some(error => error.includes('Broken link')));
  const file = path.join(f.directory, '.harness/generated.json'), receipt = readJson(file); receipt.files = []; writeJson(file, receipt);
  assert.ok(checkHarness(f.directory).errors.some(error => error.includes('Missing receipt entry')));
  receipt.sources = []; writeJson(file, receipt);
  assert.ok(checkHarness(f.directory).errors.some(error => error.includes('Missing source receipt entry')));
});

test('settings conflicts and unsupported host permissions are explicit', t => {
  const f = fixture(t); fs.mkdirSync(path.join(f.directory, '.codex'));
  fs.writeFileSync(path.join(f.directory, '.codex/config.toml'), 'default_permissions = ":workspace"\n');
  assert.ok(makeHarnessPlan(f.directory, f.spec).conflicts.some(conflict => conflict.reason.includes('permission profiles')));
  fs.writeFileSync(path.join(f.directory, '.codex/config.toml'), 'sandbox_mode = "read-only"\n');
  assert.ok(makeHarnessPlan(f.directory, f.spec).conflicts.some(conflict => conflict.reason.includes('sandbox_mode')));
});

test('retired artifacts are reported without deleting working files', t => {
  const f = fixture(t); generate(f); delete f.spec.agents;
  const plan = makeHarnessPlan(f.directory, f.spec);
  assert.ok(plan.conflicts.some(conflict => conflict.path === '.codex/agents/reader.toml'));
  assert.throws(() => applyHarnessPlan(plan), /conflicts/);
  assert.ok(fs.existsSync(path.join(f.directory, '.codex/agents/reader.toml')));
});

test('retiring merged permission values requires reconciliation instead of silently retaining them', t => {
  const f = fixture(t); generate(f); f.spec.settings.commands = f.spec.settings.commands.filter(policy => policy.decision !== 'ask');
  const plan = makeHarnessPlan(f.directory, f.spec);
  assert.ok(plan.conflicts.some(conflict => conflict.reason.includes('Retired generated setting')));
  const file = path.join(f.directory, '.claude/settings.json'), settings = readJson(file); delete settings.permissions.ask; writeJson(file, settings);
  const reconciled = makeHarnessPlan(f.directory, f.spec, { adopt: ['.claude/settings.json'] });
  assert.deepEqual(reconciled.conflicts, []); applyHarnessPlan(reconciled);
  assert.equal(readJson(file).permissions.ask, undefined);
});

test('outputs cannot replace their source, collide by case, or become another output directory', t => {
  const f = fixture(t); f.spec.sources.push({ path: 'AGENTS.md' }); fs.writeFileSync(path.join(f.directory, 'AGENTS.md'), 'Source guidance.');
  assert.throws(() => makeHarnessPlan(f.directory, f.spec), /own source/);
  const spec = sample(); spec.documents.push({ path: 'docs/harness/OVERVIEW.md', body: 'Another guide' });
  assert.throws(() => renderHarness(spec, { check: '', hook: '', notices: '' }), /case-insensitive/);
  delete spec.documentation_root; // Exercise legacy path collision checks independently of the selected-root constraint.
  spec.documents.pop(); spec.documents.push({ path: 'docs/harness', body: 'A file' });
  spec.documents.push({ path: 'docs/harness-extra.md', body: 'A sibling that sorts before the child paths' });
  assert.throws(() => renderHarness(spec, { check: '', hook: '', notices: '' }), /parent directory/);
});

test('write failures roll back created files and existing entry points', t => {
  const f = fixture(t); fs.writeFileSync(path.join(f.directory, 'AGENTS.md'), 'Original instructions.\n');
  const rename = fs.renameSync;
  const mock = t.mock.method(fs, 'renameSync', (source, target) => { if (target.endsWith('/generated.json')) throw new Error('Synthetic receipt failure'); return rename(source, target); });
  assert.throws(() => applyHarnessPlan(makeHarnessPlan(f.directory, f.spec)), /Synthetic receipt failure/); mock.mock.restore();
  assert.equal(f.read('AGENTS.md'), 'Original instructions.\n');
  assert.equal(fs.existsSync(path.join(f.directory, '.claude')), false);
  assert.equal(fs.existsSync(path.join(f.directory, '.harness/.generation.lock')), false);
  generate(f); assert.equal(checkHarness(f.directory).status, 'passed');
});

test('an edit during apply is retained and other generated changes roll back', t => {
  const f = fixture(t); fs.writeFileSync(path.join(f.directory, 'AGENTS.md'), 'Initial instructions.\n');
  const plan = makeHarnessPlan(f.directory, f.spec), rename = fs.renameSync;
  const mock = t.mock.method(fs, 'renameSync', (source, target) => {
    const result = rename(source, target);
    if (target.endsWith('/overview.md')) fs.writeFileSync(path.join(f.directory, 'AGENTS.md'), 'Concurrent instructions.\n');
    return result;
  });
  assert.throws(() => applyHarnessPlan(plan), /Output changed during generation/); mock.mock.restore();
  assert.equal(f.read('AGENTS.md'), 'Concurrent instructions.\n');
  assert.equal(fs.existsSync(path.join(f.directory, '.harness/generated.json')), false);
  assert.equal(fs.existsSync(path.join(f.directory, 'docs/harness')), false);
});

test('an active generation lock, escaping symlinks and changed aliases reject writes', t => {
  const f = fixture(t); fs.mkdirSync(path.join(f.directory, '.harness/.generation.lock'), { recursive: true });
  assert.throws(() => makeHarnessPlan(f.directory, f.spec), /locked/); fs.rmdirSync(path.join(f.directory, '.harness/.generation.lock'));
  const elsewhere = path.join(f.root, 'elsewhere'); fs.mkdirSync(elsewhere); fs.symlinkSync(elsewhere, path.join(f.directory, '.claude'));
  assert.throws(() => makeHarnessPlan(f.directory, f.spec), /escapes/); assert.deepEqual(fs.readdirSync(elsewhere), []);
  fs.unlinkSync(path.join(f.directory, '.claude')); fs.mkdirSync(path.join(f.directory, '.codex')); fs.symlinkSync('.codex', path.join(f.directory, '.claude'));
  const plan = makeHarnessPlan(f.directory, f.spec);
  fs.unlinkSync(path.join(f.directory, '.claude')); fs.mkdirSync(path.join(f.directory, 'alternate')); fs.symlinkSync('alternate', path.join(f.directory, '.claude'));
  assert.throws(() => applyHarnessPlan(plan), /changed since preview/);
});

test('spec validation rejects unsafe paths, collisions, unsupported fields and unexercised guards', () => {
  const invalid = [];
  let value = sample(); value.targets = ['unknown']; invalid.push(value);
  value = sample(); value.documents[0].path = '../outside'; invalid.push(value);
  value = sample(); value.documents[0].path = '.harness/generated.json'; invalid.push(value);
  value = sample(); value.skills[0].name += '\n'; invalid.push(value);
  value = sample(); value.commands[0].name = value.skills[0].name; invalid.push(value);
  value = sample(); value.settings.commands[0].prefix = ['git', '*']; invalid.push(value);
  value = sample(); value.settings.codex.sandbox_mode = 'danger-full-access'; invalid.push(value);
  value = sample(); value.hooks.cases = value.hooks.cases.filter(example => example.expected === 'pass'); invalid.push(value);
  value = sample(); value.agents[0].model = 'unrequested'; invalid.push(value);
  for (const spec of invalid) assert.throws(() => validateHarnessSpec(spec), { name: 'HarnessError' });
  const draft = planOnboarding({ schema_version: 1, harness: {} });
  assert.ok(draft.questions.some(question => question.id === 'harness.targets'));
  assert.ok(draft.questions.some(question => question.id === 'harness.artifacts'));
  assert.equal(draft.harness.activation, 'not run');
  const original = sample(), copy = structuredClone(original);
  renderHarness(original, { check: 'check', hook: 'hook', notices: 'license' }); assert.deepEqual(original, copy);
});

test('full CLI previews and applies artifacts outside the Kit checkout', t => {
  const f = fixture(t), spec = path.join(f.root, 'spec.json'), plan = path.join(f.root, 'plan.json'); writeJson(spec, f.spec);
  fs.writeFileSync(plan, run(CLI, ['plan', '--workspace', f.directory, '--spec', spec], { cwd: f.root }).stdout);
  assert.equal(JSON.parse(run(CLI, ['apply', '--plan', plan], { cwd: f.root }).stdout).status, 'applied');
  assert.equal(JSON.parse(run(CLI, ['check', '--workspace', f.directory, '--local'], { cwd: f.root }).stdout).status, 'passed');
});
