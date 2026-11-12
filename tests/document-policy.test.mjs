import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { planOnboarding, validateOnboarding, validateHarnessSpec } from '../dist/index.js';
import { makePlan, applyPlan } from '../dist/workspace.js';
import { makeHarnessPlan, applyHarnessPlan } from '../dist/harness.js';
import { checkHarness } from '../dist/harness-check.js';
import { ROOT, WORKSPACE, temporary, repo, readJson, writeJson, run } from './helpers.mjs';

const profile = () => ({ schema_version: 1, language: 'zh-CN', background: 'Synthetic local documentation initialization.',
  activities: { development: false, testing: false, deployment: false, operations: false },
  documentation: { placement: 'members', root: '.harness/docs', entrypoint: 'AGENTS.md' },
  harness: { layout: 'centralized', targets: ['codex', 'claude-code'], artifacts: {
    documents: true, skills: false, commands: false, agents: false, rules: false, settings: false, hooks: false, ci: false } } });
const spec = () => ({ schema_version: 1, name: 'Synthetic harness', language: 'zh-CN', layout: 'centralized',
  documentation_root: '.harness/docs', targets: ['codex', 'claude-code'], sources: [],
  documents: [{ path: '.harness/docs/index.md', body: '# 工程文档\n\n从源码核实项目行为。' }] });
function write(root, file, content = '# Existing document\n') {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), content);
}

test('initialization asks for language and persists the explicit answer across CLI refreshes', t => {
  const root = repo(temporary(t), 'service'), input = profile(), file = path.join(temporary(t), 'profile.json');
  delete input.language; writeJson(file, input);
  const draft = JSON.parse(run(path.join(ROOT, 'skills/harness-init/scripts/onboarding.mjs'), ['plan', file]).stdout);
  assert.equal(draft.language, 'undecided'); assert.equal(draft.status, 'needs-input');
  assert.deepEqual(draft.questions.map(item => item.id), ['language']);
  const plan = JSON.parse(run(WORKSPACE, ['plan', '--workspace', root, '--member', 'service', 'init', root, '--profile', file, '--language', 'zh-CN']).stdout);
  assert.equal(plan.shared.language, 'zh-CN'); assert.equal(plan.shared.onboarding.language, 'zh-CN');
  assert.equal(plan.effective_languages.service, 'zh-CN'); applyPlan(plan);
  const refresh = makePlan(root, [['service', 'init', root]]);
  assert.equal(planOnboarding(refresh.shared.onboarding).status, 'planned');
  assert.equal(refresh.shared.language, 'zh-CN');
  assert.throws(() => makePlan(root, [], 'en', [], { profile: profile() }), /differs.*profile language/);
});

test('document inventory prompts for nested existing guides without guessing authorship or moving files', t => {
  const root = repo(temporary(t), 'service');
  for (const name of ['README.md', 'docs/design.md', 'notes/RESULT.MD', 'guide.rst', 'AGENTS.md', 'skills/task/SKILL.md',
    '.codex/docs/legacy.md', '.claude/docs/setup.md', '.harness/docs/inside.md', '.harness/rules/boundaries.md', '.claude/commands/review.md',
    'vendor/third-party.md', '.build/cache.md', 'private/secret.md']) write(root, name);
  write(root, '.gitignore', 'private/\n');
  fs.symlinkSync('docs/design.md', path.join(root, 'alias.md'));
  const plan = makePlan(root, [['service', 'init', root]], null, [], { profile: profile() });
  const report = plan.document_consolidation.service;
  assert.equal(report.status, 'needs-input'); assert.equal(report.member_writable, true);
  assert.deepEqual(report.documents.map(item => item.path), ['.claude/docs/setup.md', '.codex/docs/legacy.md', 'README.md', 'docs/design.md', 'guide.rst', 'notes/RESULT.MD']);
  assert.ok(report.documents.every(item => item.action === 'undecided' && /^[a-f0-9]{64}$/.test(item.sha256)));
  assert.match(report.question, /which should move/); assert.match(report.limits, /do not establish AI authorship/);
  applyPlan(plan);
  assert.equal(fs.readFileSync(path.join(root, 'docs/design.md'), 'utf8'), '# Existing document\n');
  assert.equal(fs.existsSync(path.join(root, '.harness/docs/design.md')), false);
  const refreshed = makePlan(root, [['service', 'init', root]]);
  write(root, 'docs/design.md', '# Edited after preview\n');
  assert.throws(() => applyPlan(refreshed), /changed since preview/);
});

test('explicit keep and move choices survive refresh; applying metadata never executes a move', t => {
  const root = repo(temporary(t), 'service'), input = profile();
  write(root, 'README.md'); write(root, 'notes/plan.md');
  input.documentation.existing_documents = [
    { member: 'service', path: 'README.md', action: 'keep' },
    { member: 'service', path: 'notes/plan.md', action: 'move', destination: '.harness/docs/plan.md' },
  ];
  const selected = [['service', 'init', root]];
  let plan = makePlan(root, selected, null, [], { profile: input });
  assert.equal(plan.document_consolidation.service.status, 'moves-pending');
  assert.equal(plan.document_consolidation.service.question, null); applyPlan(plan);
  assert.equal(fs.existsSync(path.join(root, 'notes/plan.md')), true);
  assert.equal(fs.existsSync(path.join(root, '.harness/docs/plan.md')), false);
  assert.deepEqual(readJson(path.join(root, '.harness/workspace.json')).onboarding.documentation.existing_documents, input.documentation.existing_documents);
  plan = makePlan(root, selected); assert.equal(plan.document_consolidation.service.question, null);
  write(root, '.harness/docs/plan.md', '# Independently authored guide\n');
  plan = makePlan(root, selected); assert.equal(plan.document_consolidation.service.documents[1].destination_exists, true);
  write(root, 'notes/new.md');
  assert.equal(makePlan(root, selected).document_consolidation.service.status, 'needs-input');
});

test('register selections do not scan documents and analyzed external members remain read-only', t => {
  const parent = temporary(t), coordinator = repo(parent, 'coordinator'), external = repo(parent, 'external'); write(external, 'docs/guide.md');
  const input = profile();
  const localAnalysis = makePlan(coordinator, [['coordinator', 'analyze', coordinator]], null, [], { profile: input });
  assert.equal(localAnalysis.document_consolidation.coordinator.member_writable, false);
  input.documentation.placement = 'coordinator';
  let plan = makePlan(coordinator, [['external', 'register', external]], null, [], { profile: input });
  assert.deepEqual(plan.document_consolidation, {});
  plan = makePlan(coordinator, [['external', 'analyze', external]], null, [], { profile: input });
  assert.equal(plan.document_consolidation.external.member_writable, false);
  assert.equal(plan.document_consolidation.external.status, 'needs-input'); applyPlan(plan);
  assert.equal(fs.existsSync(path.join(external, '.harness')), false);
});

test('migration choices reject ambiguous actions, escaping destinations and destination collisions', () => {
  const valid = { member: 'service', path: 'docs/guide.md', action: 'move', destination: '.harness/docs/guide.md' };
  for (const change of [{ action: 'automatic' }, { destination: '../guide.md' }, { destination: 'docs/guide.md' }, { action: 'keep' }, { member: '../service' }]) {
    const input = profile(); input.documentation.existing_documents = [{ ...valid, ...change }];
    assert.throws(() => validateOnboarding(input), { name: 'OnboardingError' });
  }
  const input = profile(); input.documentation.existing_documents = [valid, { ...valid, path: 'notes/guide.md' }];
  assert.throws(() => validateOnboarding(input), /same destination/);
  for (const language of [null, 'zh_CN', 'fr']) assert.throws(() => validateOnboarding({ ...profile(), language }), /Choose en or zh-CN/);
});

test('generated canonical instructions bind future AI documents to the selected root and language', t => {
  const root = repo(temporary(t), 'service'); applyPlan(makePlan(root, [['service', 'init', root]], null, [], { profile: profile() }));
  assert.throws(() => makeHarnessPlan(root, { ...spec(), language: 'en' }), /language differs/);
  assert.throws(() => makeHarnessPlan(root, { ...spec(), documentation_root: '.harness/docs/team', documents: [] }), /documentation_root differs/);
  applyHarnessPlan(makeHarnessPlan(root, spec()));
  const entry = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  assert.match(entry, /所有由 AI 新增的项目文档/); assert.match(entry, /必须放在 `\.harness\/docs\/`/);
  assert.match(entry, /询问用户选择迁入哪些文档/); assert.equal(fs.readlinkSync(path.join(root, 'CLAUDE.md')), 'AGENTS.md');
  const checked = checkHarness(root, true); assert.equal(checked.status, 'passed', JSON.stringify(checked));
  assert.equal(checked.configuration.documentation_policy.enforcement, 'agent-instructions');
  assert.deepEqual(applyHarnessPlan(makeHarnessPlan(root, spec())).written, []);
});

test('native custom documentation roots are reflected in both entries and reject out-of-root outputs', t => {
  const root = repo(temporary(t), 'service'), input = profile();
  input.language = 'en'; input.harness.layout = 'native'; input.documentation.root = '.codex/docs';
  applyPlan(makePlan(root, [], null, [], { profile: input }));
  const native = { ...spec(), language: 'en', layout: 'native', documentation_root: '.codex/docs', documents: [{ path: '.codex/docs/index.md', body: '# Guide\n\nProject guidance.' }] };
  assert.throws(() => validateHarnessSpec({ ...native, documents: [{ path: 'notes/design.md', body: 'Outside' }] }), /inside documentation_root/);
  applyHarnessPlan(makeHarnessPlan(root, native));
  for (const entry of ['AGENTS.md', 'CLAUDE.md']) assert.match(fs.readFileSync(path.join(root, entry), 'utf8'), /must live under `\.codex\/docs\/`/);
  assert.equal(checkHarness(root, true).status, 'passed');
});

test('the output member language overrides the workspace choice and later drift fails checking', t => {
  const root = repo(temporary(t), 'service');
  applyPlan(makePlan(root, [['service', 'init', root]], null, [['service', 'en']], { profile: profile() }));
  applyHarnessPlan(makeHarnessPlan(root, { ...spec(), language: 'en' }));
  assert.equal(checkHarness(root, true).status, 'passed');
  applyPlan(makePlan(root, [['service', 'init', root]], null, [['service', 'zh-CN']]));
  const check = checkHarness(root, true);
  assert.equal(check.status, 'failed'); assert.ok(check.errors.some(error => error.includes('language differs')));
});
