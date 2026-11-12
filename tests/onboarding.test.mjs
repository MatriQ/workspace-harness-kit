import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { planOnboarding, validateOnboarding, validateManifest } from '../dist/index.js';
import { inspectToolchain } from '../dist/onboarding.js';
import { applyPlan, makePlan, checkWorkspace } from '../dist/workspace.js';
import { ROOT, WORKSPACE, temporary, repo, readJson, writeJson, run } from './helpers.mjs';

const ONBOARDING = path.join(ROOT, 'skills/harness-init/scripts/onboarding.mjs');
const awsProfile = () => readJson(path.join(ROOT, 'skills/harness-init/assets/onboarding-aws.json'));
const activities = (overrides = {}) => ({ development: false, testing: false, deployment: false, operations: false, ...overrides });
const localProfile = () => ({ schema_version: 1, language: 'en', background: 'Local API development and regression testing.',
  activities: activities({ development: true, testing: true }), tool_policy: 'inspect-only' });
const questionIds = plan => plan.questions.map(question => question.id);
const ok = stdout => ({ status: 0, stdout, stderr: '' });

test('a draft preserves unanswered activities without prematurely choosing cloud tools', () => {
  const draft = { schema_version: 1 }, before = structuredClone(draft), plan = planOnboarding(draft);
  assert.equal(plan.status, 'needs-input');
  assert.deepEqual(questionIds(plan), ['language', 'background', 'activities']);
  assert.deepEqual(plan.tools, []); assert.deepEqual(plan.platform_guides, []);
  assert.deepEqual(draft, before);
  draft.activities = activities({ operations: true });
  assert.ok(questionIds(planOnboarding(draft)).includes('platforms'));
  assert.ok(!questionIds(planOnboarding(draft)).includes('tool_policy'));
});

test('local-only setup omits cloud questions and deployment or operations guides', () => {
  const plan = planOnboarding(localProfile());
  assert.equal(plan.status, 'planned'); assert.deepEqual(plan.questions, []);
  assert.deepEqual(plan.tools, []); assert.deepEqual(plan.platform_guides, []);
  assert.deepEqual(plan.documents.map(document => path.basename(document.path)), ['index.md', 'development.md', 'testing.md', 'toolchain.md']);
});

test('AWS releases and operations select provider and pipeline tools without speculative extras', () => {
  const profile = awsProfile(), before = structuredClone(profile), plan = planOnboarding(profile);
  assert.equal(plan.status, 'planned'); assert.deepEqual(questionIds(plan), []);
  assert.deepEqual(plan.tools.map(tool => tool.id), ['aws', 'gh']);
  assert.ok(plan.documents.some(document => document.path.endsWith('/release.md')));
  assert.ok(plan.documents.some(document => document.path.endsWith('/operations.md')));
  assert.ok(Object.values(plan.execution).every(status => status === 'not run'));
  assert.deepEqual(profile, before);
  plan.tools[0].definition.executable = 'untrusted-replacement';
  plan.tools[0].definition.version_args.push('unexpected-argument');
  const fresh = planOnboarding(profile).tools[0].definition;
  assert.equal(fresh.executable, 'aws'); assert.deepEqual(fresh.version_args, ['--version']);
});

test('operations-only Azure does not require a delivery pipeline', () => {
  const plan = planOnboarding({ schema_version: 1, language: 'en', background: 'Investigate a synthetic worker.',
    activities: activities({ operations: true }), tool_policy: 'install-missing',
    platforms: [{ id: 'azure-main', provider: 'azure', services: ['Functions'], environments: ['staging'], access: 'cli' }] });
  assert.equal(plan.status, 'planned'); assert.deepEqual(plan.tools.map(tool => tool.id), ['azure']);
  assert.ok(!plan.documents.some(document => document.path.endsWith('/release.md')));
});

test('platform follow-ups retain missing targets, access and delivery until answered', () => {
  const profile = awsProfile(); profile.platforms = [{ id: 'aws-main', provider: 'aws' }];
  assert.deepEqual(questionIds(planOnboarding(profile)), ['aws-main.targets', 'aws-main.access', 'aws-main.delivery']);
  assert.deepEqual(planOnboarding(profile).tools, []);
  profile.platforms[0].access = 'cli';
  assert.deepEqual(planOnboarding(profile).tools.map(tool => tool.id), ['aws']);
});

test('multiple platforms deduplicate shared tooling and preserve per-platform context', () => {
  const profile = awsProfile();
  profile.platforms[0].tools = ['kubectl'];
  profile.platforms.push({ id: 'gcp-main', provider: 'gcp', services: ['GKE'], environments: ['staging'], access: 'cli', delivery: 'github-actions', tools: ['kubectl', 'helm'] });
  const plan = planOnboarding(profile);
  assert.deepEqual(plan.tools.map(tool => tool.id), ['aws', 'gh', 'kubectl', 'gcloud', 'helm']);
  assert.equal(plan.tools.find(tool => tool.id === 'kubectl').reasons.length, 2);
  assert.deepEqual(plan.platform_guides.map(guide => guide.platform), ['aws-main', 'gcp-main']);
});

test('documentation-only and existing access do not prompt for CLI installation or execute probes', () => {
  for (const access of ['documentation-only', 'existing-tools']) {
    const profile = awsProfile(); profile.activities = activities({ operations: true });
    profile.platforms[0].access = access; delete profile.tool_policy;
    const plan = planOnboarding(profile);
    assert.equal(plan.status, 'planned'); assert.deepEqual(plan.tools, []);
    const inspection = inspectToolchain(profile, () => { throw new Error('Unexpected executable'); });
    assert.deepEqual(inspection.tools, []);
    assert.equal(inspection.authentication, 'not run'); assert.equal(inspection.target_access, 'not run');
  }
});

test('other providers ask for their actual tools and never execute custom profile text', () => {
  const profile = awsProfile();
  profile.platforms = [{ id: 'private', provider: 'other', name: 'Synthetic Private Cloud', services: ['VM'],
    environments: ['staging'], access: 'cli', delivery: 'manual' }];
  assert.ok(questionIds(planOnboarding(profile)).includes('private.tools'));
  profile.platforms[0].tools = ['vendor-tool; unexpected-command'];
  const inspected = inspectToolchain(profile, () => { throw new Error('Custom text was executed'); });
  assert.equal(inspected.status, 'pending'); assert.equal(inspected.tools[0].status, 'manual');
});

test('documentation plans honor central and member-local conventions', () => {
  const profile = awsProfile();
  profile.documentation = { placement: 'coordinator', root: '.codex/docs', entrypoint: 'CLAUDE.md' };
  const central = planOnboarding(profile);
  assert.ok(central.documents.every(document => document.scope === 'workspace'));
  assert.equal(central.documents[0].path, '.codex/docs/index.md');
  assert.equal(central.documents.at(-1).path, 'CLAUDE.md');
  profile.documentation.placement = 'members';
  assert.ok(planOnboarding(profile).documents.every(document => document.scope === 'selected-members'));
});

test('profile validation rejects ambiguous values, unknown fields and escaping documentation paths', () => {
  const invalid = [null, [], {}, { schema_version: 2 }, { schema_version: 1, activities: { deploy: true } },
    { schema_version: 1, activities: { deployment: null } }, { schema_version: 1, tool_policy: 'always' },
    { schema_version: 1, token: 'synthetic' }, { schema_version: 1, background: '' },
    { schema_version: 1, platforms: null }, { schema_version: 1, platforms: [{ id: 'main', provider: 'other' }] },
    { schema_version: 1, platforms: [{ id: 'main\n', provider: 'aws' }] },
    { schema_version: 1, platforms: [{ id: 'main', provider: 'aws', access: 'root' }] },
    { schema_version: 1, platforms: [{ id: 'main', provider: 'aws', services: ['ECS', 'ECS'] }] },
    { schema_version: 1, platforms: [{ id: 'main', provider: 'aws' }, { id: 'main', provider: 'azure' }] }];
  for (const root of ['../docs', '/docs', 'docs/../elsewhere', 'docs\\elsewhere', 'docs\n', '']) {
    invalid.push({ schema_version: 1, documentation: { placement: 'coordinator', root } });
  }
  for (const profile of invalid) assert.throws(() => validateOnboarding(profile), { name: 'OnboardingError' });
  assert.throws(() => validateManifest({ schema_version: 1, language: 'en', members: [], onboarding: null }), { name: 'OnboardingError' });
});

test('tool inspection separates availability, compatibility and execution state without retaining diagnostic output', () => {
  const profile = awsProfile(); profile.platforms[0].tools = ['kubectl', 'terraform', 'docker', 'helm'];
  const calls = [], responses = {
    aws: { ...ok(''), stderr: 'aws-cli/1.32.0 Python/3.11 synthetic-sensitive-output' },
    gh: { status: null, stdout: '', stderr: 'synthetic-sensitive-output', error: { code: 'ENOENT' } },
    kubectl: ok(JSON.stringify({ clientVersion: { gitVersion: 'v1.34.1' }, private: 'synthetic-sensitive-output' })),
    terraform: { status: null, stdout: '', stderr: 'synthetic-sensitive-output', error: { code: 'ETIMEDOUT' } },
    docker: { ...ok('Docker version 28.0.0, build synthetic'), status: 1 },
    helm: ok('unexpected synthetic-sensitive-output'),
  };
  const result = inspectToolchain(profile, tool => { calls.push(tool); return responses[tool.id]; });
  assert.equal(result.status, 'pending');
  assert.deepEqual(result.tools.map(tool => tool.status), ['incompatible', 'missing', 'available', 'unverified', 'unverified', 'unverified']);
  assert.deepEqual(calls.find(tool => tool.id === 'kubectl').version_args, ['version', '--client=true', '--output=json']);
  assert.ok(calls.every(tool => !tool.version_args.some(argument => ['login', 'auth', 'install', 'get-caller-identity'].includes(argument))));
  assert.doesNotMatch(JSON.stringify(result), /synthetic-sensitive-output/);
  assert.equal(result.installation, 'not run'); assert.equal(result.authentication, 'not run'); assert.equal(result.target_access, 'not run');
});

test('maintained CLI versions parse successfully while project and target checks remain separate', () => {
  const profile = awsProfile(); profile.platforms[0].tools = ['azure', 'gcloud', 'kubectl', 'terraform', 'docker', 'helm'];
  const responses = { aws: 'aws-cli/2.30.0 Python/3.13', gh: 'gh version 2.78.0 (synthetic)',
    azure: '{"azure-cli":"2.78.0"}', gcloud: '{"Google Cloud SDK":"540.0.0"}',
    kubectl: '{"clientVersion":{"gitVersion":"v1.34.1"}}', terraform: '{"terraform_version":"1.13.3"}',
    docker: 'Docker version 28.0.0, build synthetic', helm: 'v3.19.0+synthetic' };
  const result = inspectToolchain(profile, tool => ok(responses[tool.id]));
  assert.equal(result.status, 'checked'); assert.ok(result.tools.every(tool => tool.status === 'available'));
  assert.equal(result.target_access, 'not run');
  delete profile.activities.testing;
  assert.equal(inspectToolchain(profile, tool => ok(responses[tool.id])).status, 'pending');
});

test('profile snapshots persist through plan/apply and refresh without losing local status', t => {
  const root = temporary(t), directory = repo(root, 'coordinator'), profile = localProfile();
  const plan = makePlan(directory, [], null, [], { profile });
  profile.background = 'Changed after preview';
  applyPlan(plan);
  const localPath = path.join(directory, '.harness/workspace.local.json'), local = readJson(localPath);
  local.onboarding_status = { installation: { status: 'pending', next_action: 'Inspect project runtime' } }; writeJson(localPath, local);
  applyPlan(makePlan(directory));
  assert.equal(readJson(path.join(directory, '.harness/workspace.json')).onboarding.background, localProfile().background);
  assert.deepEqual(readJson(localPath).onboarding_status, local.onboarding_status);
  assert.equal(checkWorkspace(directory, true).onboarding.status, 'planned');
  const modified = makePlan(directory, [], null, [], { profile });
  modified.shared.onboarding.background = 'An unreviewed different choice';
  assert.throws(() => applyPlan(modified), /changed since preview/);
});

test('changed choices invalidate final document reviews until explicitly reviewed again', t => {
  const root = temporary(t), directory = repo(root, 'api'), profile = localProfile();
  fs.mkdirSync(path.join(directory, 'docs'));
  fs.writeFileSync(path.join(directory, 'docs/guide.md'), 'Local development guide.\n');
  const selected = [['api', 'analyze', directory]], reviews = [['api', 'docs/guide.md']];
  applyPlan(makePlan(directory, selected, null, [], { profile, reviews }));
  assert.equal(checkWorkspace(directory, true).document_reviews[0].status, 'current');
  profile.activities.operations = true;
  applyPlan(makePlan(directory, selected, null, [], { profile }));
  let check = checkWorkspace(directory, true);
  assert.equal(check.document_reviews[0].status, 'pending');
  assert.match(check.warnings.join('\n'), /initialization choices changed/);
  assert.equal(check.onboarding.status, 'needs-input');
  applyPlan(makePlan(directory, selected));
  assert.equal(checkWorkspace(directory, true).document_reviews[0].status, 'pending');
  applyPlan(makePlan(directory, selected, null, [], { reviews }));
  check = checkWorkspace(directory, true);
  assert.equal(check.document_reviews[0].status, 'current');
  assert.equal(check.onboarding.status, 'needs-input'); // Document review is not completed onboarding.
});

test('legacy reviews stay current until introducing a profile and support the real symlink target', t => {
  const root = temporary(t), directory = repo(root, 'coordinator');
  fs.writeFileSync(path.join(directory, 'CLAUDE.md'), 'Existing hand-written routing.\n');
  fs.symlinkSync('CLAUDE.md', path.join(directory, 'AGENTS.md'));
  const selected = [['coordinator', 'analyze', directory]], reviews = [['coordinator', 'CLAUDE.md']];
  applyPlan(makePlan(directory, selected, null, [], { reviews }));
  assert.equal(checkWorkspace(directory, true).document_reviews[0].status, 'current');
  applyPlan(makePlan(directory, [], null, [], { profile: localProfile() }));
  assert.equal(checkWorkspace(directory, true).document_reviews[0].status, 'pending');
  applyPlan(makePlan(directory, selected, null, [], { reviews }));
  assert.equal(checkWorkspace(directory, true).document_reviews[0].status, 'current');
  assert.equal(fs.readlinkSync(path.join(directory, 'AGENTS.md')), 'CLAUDE.md');
});

test('bundled onboarding and workspace CLIs accept profile files outside the Kit checkout', t => {
  const root = temporary(t), profileFile = path.join(root, 'profile.json'), planFile = path.join(root, 'plan.json');
  writeJson(profileFile, localProfile());
  assert.equal(JSON.parse(run(ONBOARDING, ['plan', profileFile], { cwd: root }).stdout).status, 'planned');
  assert.equal(JSON.parse(run(path.join(ROOT, 'dist/cli.mjs'), ['onboarding', 'plan', profileFile], { cwd: root }).stdout).status, 'planned');
  fs.writeFileSync(planFile, run(WORKSPACE, ['plan', '--workspace', root, '--profile', profileFile], { cwd: root }).stdout);
  writeJson(profileFile, { schema_version: 1 }); // Applying uses the embedded snapshot.
  run(WORKSPACE, ['apply', '--plan', planFile], { cwd: root });
  assert.deepEqual(readJson(path.join(root, '.harness/workspace.json')).onboarding, localProfile());
  assert.equal(JSON.parse(run(ONBOARDING, ['tools', profileFile], { cwd: root, code: 2 }).stdout).status, 'pending');
  writeJson(profileFile, { schema_version: 0 });
  assert.equal(JSON.parse(run(ONBOARDING, ['plan', profileFile], { cwd: root, code: 2 }).stdout).status, 'invalid');
});

test('real CLI probes use fixed version arguments and report a missing executable without installing it', t => {
  const root = temporary(t), bin = path.join(root, 'bin'), profileFile = path.join(root, 'profile.json'), calls = path.join(root, 'calls.json');
  fs.mkdirSync(bin);
  const profile = awsProfile(); profile.platforms[0].delivery = 'manual'; profile.tool_policy = 'install-missing';
  writeJson(profileFile, profile);
  const env = { ...process.env, PATH: bin };
  const missing = JSON.parse(run(ONBOARDING, ['tools', profileFile], { cwd: root, env, code: 2 }).stdout);
  assert.equal(missing.tools[0].status, 'missing'); assert.equal(missing.installation, 'not run');
  assert.deepEqual(fs.readdirSync(bin), []);
  fs.writeFileSync(path.join(bin, 'aws'), `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(calls)}, JSON.stringify(process.argv.slice(2)));\nprocess.stdout.write('aws-cli/2.30.0 synthetic-sensitive-output');\n`, { mode: 0o755 });
  const available = JSON.parse(run(ONBOARDING, ['tools', profileFile], { cwd: root, env }).stdout);
  assert.equal(available.status, 'checked'); assert.equal(available.tools[0].version, '2.30.0');
  assert.deepEqual(readJson(calls), ['--version']); assert.equal(available.authentication, 'not run');
  assert.doesNotMatch(JSON.stringify(available), /synthetic-sensitive-output/);
});
