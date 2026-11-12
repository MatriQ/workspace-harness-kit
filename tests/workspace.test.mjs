import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { applyPlan, makePlan, checkWorkspace, validateManifest, componentModel, analyze, normalizedRemote } from '../dist/workspace.js';
import { ROOT, WORKSPACE, temporary, repo, git, readJson, writeJson, run } from './helpers.mjs';

function fixture(t) {
  const root = temporary(t), directory = path.join(root, 'working'); fs.mkdirSync(directory);
  return { root, directory, repo: (name, remote) => repo(root, name, remote),
    plan: (...members) => makePlan(directory, members), apply: applyPlan,
    check: () => checkWorkspace(directory, true), cli: (args, options) => run(WORKSPACE, args, options) };
}
test('empty workspace defaults, read-only preview and repeat apply', t => {
  const f = fixture(t), plan = f.plan(); assert.equal(plan.shared.language, 'en');
  assert.equal(fs.existsSync(path.join(f.directory, '.harness')), false);
  f.apply(plan); assert.deepEqual(f.apply(f.plan()).written, []); assert.deepEqual(f.check().errors, []);
});
test('selected external repositories do not mutate member files or expose checkout paths', t => {
  const f = fixture(t), first = f.repo('group/api'), second = f.repo('group/archive'), external = f.repo('outside/product-docs');
  fs.writeFileSync(path.join(first, 'README.md'), 'Existing hand-written content.\n');
  f.apply(f.plan(['api', 'register', first], ['docs', 'analyze', external]));
  const registry = readJson(path.join(f.directory, '.harness/workspace.json'));
  assert.deepEqual(registry.members.map(member => member.id), ['api', 'docs']);
  assert.equal(fs.existsSync(path.join(first, '.harness')), false); assert.equal(fs.existsSync(path.join(second, 'AGENTS.md')), false);
  assert.equal(fs.readFileSync(path.join(first, 'README.md'), 'utf8'), 'Existing hand-written content.\n');
  assert.ok(!JSON.stringify(registry).includes(f.root));
});
test('member language overrides workspace language and survives refresh', t => {
  const f = fixture(t), directory = f.repo('api');
  const plan = makePlan(f.directory, [['api', 'init', directory]], 'zh-CN', [['api', 'ja']]);
  assert.equal(plan.effective_languages.api, 'ja'); f.apply(plan);
  const refreshed = f.plan(['api', 'init', directory]); assert.equal(refreshed.shared.language, 'zh-CN'); assert.equal(refreshed.effective_languages.api, 'ja');
});
test('discovery groups remote identities while retaining worktree candidates and stripping credentials', t => {
  const f = fixture(t), directory = f.repo('api', 'https://secret:sentinel@github.com/example/api.git?key=secret');
  git(directory, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'fixture');
  git(directory, 'worktree', 'add', '-b', 'fixture', path.join(f.root, 'api-linked'));
  const output = JSON.parse(f.cli(['discover', '--directory', f.root]).stdout);
  assert.equal(output.repositories.length, 1); assert.equal(output.repositories[0].checkouts.length, 2);
  assert.deepEqual(new Set(output.repositories[0].checkouts.map(item => item.kind)), new Set(['checkout', 'worktree']));
  assert.doesNotMatch(JSON.stringify(output), /secret|sentinel/);
});
test('discovery honors depth, nested selection and vendor exclusions', t => {
  const f = fixture(t), directory = f.repo('group/api'), nested = f.repo('group/api/nested'); f.repo('group/node_modules/dependency');
  const discover = (...args) => JSON.parse(f.cli(['discover', '--directory', path.join(f.root, 'group'), ...args]).stdout).repositories.flatMap(item => item.checkouts).map(item => item.path);
  assert.deepEqual(discover('--depth', '0'), []); assert.deepEqual(discover(), [directory]);
  assert.deepEqual(new Set(discover('--include-nested')), new Set([directory, nested]));
});
test('discovery from a subdirectory identifies the checkout root', t => {
  const f = fixture(t), directory = f.repo('api'), sub = path.join(directory, 'src'); fs.mkdirSync(sub);
  assert.equal(JSON.parse(f.cli(['discover', '--repo', sub]).stdout).repositories[0].checkouts[0].path, directory);
  assert.equal(JSON.parse(f.cli(['discover'], { cwd: sub }).stdout).repositories[0].checkouts[0].path, directory);
});
test('default discovery scans an ordinary directory', t => {
  const f = fixture(t), directory = f.repo('working/api');
  assert.equal(JSON.parse(f.cli(['discover'], { cwd: f.directory }).stdout).repositories[0].checkouts[0].path, directory);
});
test('analysis records declarations without config values or script bodies', t => {
  const f = fixture(t), directory = f.repo('api');
  writeJson(path.join(directory, 'package.json'), { dependencies: { next: '15' }, devDependencies: { typescript: '5' }, scripts: { dev: 'TOKEN=synthetic-secret next dev' } });
  fs.writeFileSync(path.join(directory, '.env'), 'TOKEN=synthetic-secret\n'); fs.writeFileSync(path.join(directory, '.env.example'), 'TOKEN=\n');
  const plan = f.plan(['api', 'analyze', directory]), inventory = plan.analysis.api;
  assert.deepEqual(new Set(inventory.map(item => item.path)), new Set(['package.json', '.env.example']));
  assert.doesNotMatch(JSON.stringify(plan), /synthetic-secret/);
  assert.deepEqual(inventory.find(item => item.path === 'package.json').script_names, ['dev']);
  assert.deepEqual(inventory.find(item => item.path === 'package.json').frameworks, ['Next.js']);
});
test('TOML parser handles project/Poetry declarations and flags malformed inputs', t => {
  const f = fixture(t), directory = f.repo('api'), file = path.join(directory, 'pyproject.toml');
  fs.writeFileSync(file, '[project]\ndependencies=["fastapi>=0.100"]\n[tool.poetry.dependencies]\ndjango="5"\n');
  assert.deepEqual(analyze(directory)[0].frameworks, ['Django', 'FastAPI']);
  fs.writeFileSync(file, '[project\n'); assert.equal(analyze(directory)[0].parse_error, true);
});
test('a source edit invalidates a preview before any state is written', t => {
  const f = fixture(t), directory = f.repo('api'), file = path.join(directory, 'README.md'); fs.writeFileSync(file, 'Initial\n');
  const plan = f.plan(['api', 'analyze', directory]); fs.writeFileSync(file, 'Changed\n');
  assert.throws(() => f.apply(plan), /changed since preview/); assert.equal(fs.existsSync(path.join(f.directory, '.harness')), false);
});
test('a metadata edit invalidates a preview even if JSON values are unchanged', t => {
  const f = fixture(t); f.apply(f.plan()); const plan = f.plan(); fs.appendFileSync(path.join(f.directory, '.harness/workspace.json'), '\n');
  assert.throws(() => f.apply(plan), /changed since preview/);
});
test('source drift warns and strict checking fails', t => {
  const f = fixture(t), directory = f.repo('api'); writeJson(path.join(directory, 'package.json'), {}); f.apply(f.plan(['api', 'analyze', directory]));
  writeJson(path.join(directory, 'package.json'), { name: 'changed' });
  const warnings = JSON.parse(f.cli(['check', '--workspace', f.directory, '--local']).stdout).warnings;
  assert.equal(warnings.length, 1);
  assert.deepEqual(JSON.parse(f.cli(['check', '--workspace', f.directory, '--local', '--strict'], { code: 1 }).stdout).warnings, warnings);
});
test('local checkout bindings are ignored and private', t => {
  const f = fixture(t), directory = f.repo('working-member'); git(f.directory, 'init', '--initial-branch=main'); f.apply(f.plan(['api', 'register', directory]));
  assert.equal(git(f.directory, 'status', '--short'), '?? .harness/');
  assert.equal(git(f.directory, 'check-ignore', '.harness/workspace.local.json'), '.harness/workspace.local.json');
  assert.equal(fs.statSync(path.join(f.directory, '.harness/workspace.local.json')).mode & 0o777, 0o600);
});
test('tracked local state and symlinked state directory are rejected', t => {
  const f = fixture(t); git(f.directory, 'init', '--initial-branch=main');
  const state = path.join(f.directory, '.harness'); fs.mkdirSync(state); writeJson(path.join(state, 'workspace.local.json'), { schema_version: 1, checkouts: {} });
  git(f.directory, 'add', '.harness/workspace.local.json'); assert.throws(() => f.plan(), /Untrack/);
  const other = path.join(f.root, 'linked-workspace'); fs.mkdirSync(other); fs.symlinkSync(state, path.join(other, '.harness'));
  assert.throws(() => makePlan(other), /regular state/);
});
test('same repository cannot be registered under two IDs', t => {
  const f = fixture(t), directory = f.repo('api', 'git@github.com:example/api.git');
  assert.throws(() => f.plan(['first', 'register', directory], ['second', 'register', directory]), /same Git repository|Repeated remote/);
});
test('changed local repository identity is reported and rebinding is rejected', t => {
  const f = fixture(t), directory = f.repo('api', 'git@github.com:example/api.git'); f.apply(f.plan(['api', 'register', directory]));
  git(directory, 'remote', 'set-url', 'origin', 'git@github.com:example/other.git');
  assert.ok(f.check().errors.length); assert.throws(() => f.plan(['api', 'register', directory]), /identity changed/);
});
test('document paths must exist and stay within the workspace', t => {
  const f = fixture(t); f.apply(f.plan()); const file = path.join(f.directory, '.harness/workspace.json'), manifest = readJson(file);
  manifest.documents = ['docs/workspace.md']; writeJson(file, manifest); assert.equal(checkWorkspace(f.directory).errors.length, 1);
  manifest.documents = ['../elsewhere.md']; writeJson(file, manifest); assert.throws(() => checkWorkspace(f.directory), /relative file/);
});
test('branch changes invalidate a plan', t => {
  const f = fixture(t), directory = f.repo('api'), plan = f.plan(['api', 'register', directory]);
  git(directory, 'symbolic-ref', 'HEAD', 'refs/heads/other'); assert.throws(() => f.apply(plan), /changed since preview/);
});
test('analysis skips symlinks and rejects explicit escaping or excluded files', t => {
  const f = fixture(t), directory = f.repo('api'); writeJson(path.join(directory, 'real.json'), { dependencies: { next: '15' } });
  fs.symlinkSync(path.join(directory, 'real.json'), path.join(directory, 'package.json'));
  const external = path.join(f.root, 'requirements.txt'); fs.writeFileSync(external, 'fastapi'); fs.symlinkSync(external, path.join(directory, 'requirements.txt'));
  assert.deepEqual(f.plan(['api', 'analyze', directory]).analysis.api, []);
  assert.throws(() => analyze(directory, ['requirements.txt']), /escapes/);
  assert.throws(() => analyze(directory, ['node_modules/index.js']), /excluded/);
});
test('check reports missing Git ignore rules', t => {
  const f = fixture(t); git(f.directory, 'init', '--initial-branch=main'); f.apply(f.plan()); fs.unlinkSync(path.join(f.directory, '.harness/.gitignore'));
  assert.match(f.check().errors[0], /not Git-ignored/);
});
test('active apply lock blocks changes', t => {
  const f = fixture(t), plan = f.plan(); fs.mkdirSync(path.join(f.directory, '.harness/.workspace.lock'), { recursive: true });
  assert.throws(() => f.apply(plan), /locked/); assert.equal(fs.existsSync(path.join(f.directory, '.harness/workspace.json')), false);
});
test('write failure rolls back metadata and allows a later successful apply', t => {
  const f = fixture(t), directory = f.repo('api'), plan = f.plan(['api', 'register', directory]);
  // Fail the rename of the second file, after the ignore rule was written.
  const rename = fs.renameSync;
  const stub = t.mock.method(fs, 'renameSync', (source, target) => { if (path.basename(target) === 'workspace.local.json') throw new Error('Synthetic write failure'); return rename(source, target); });
  assert.throws(() => f.apply(plan), /Synthetic/); stub.mock.restore();
  assert.deepEqual(fs.readdirSync(path.join(f.directory, '.harness')), []);
  f.apply(f.plan(['api', 'register', directory])); assert.deepEqual(f.check().errors, []);
});
test('simultaneous applies cannot lose registry updates', async t => {
  const f = fixture(t), first = f.repo('api'), second = f.repo('web');
  const processes = [f.plan(['api', 'register', first]), f.plan(['web', 'register', second])].map((plan, index) => {
    const file = path.join(f.root, `parallel-${index}.json`); writeJson(file, plan);
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [WORKSPACE, 'apply', '--plan', file], { stdio: 'ignore', timeout: 20000 });
      child.on('error', reject); child.on('exit', code => resolve(code));
    });
  });
  assert.deepEqual((await Promise.all(processes)).sort(), [0, 1]);
  assert.equal(readJson(path.join(f.directory, '.harness/workspace.json')).members.length, 1); assert.deepEqual(f.check().errors, []);
});
test('full CLI plan/apply/check path', t => {
  const f = fixture(t), directory = f.repo('api'), file = path.join(f.root, 'plan.json');
  fs.writeFileSync(file, f.cli(['plan', '--workspace', f.directory, '--member', 'api', 'register', directory, '--language', 'fr']).stdout);
  assert.deepEqual(JSON.parse(f.cli(['apply', '--plan', file]).stdout).members, ['api']);
  assert.deepEqual(JSON.parse(f.cli(['check', '--workspace', f.directory, '--local']).stdout).errors, []);
});
test('new sources are drift even after an empty initial inventory', t => {
  const f = fixture(t), directory = f.repo('api'); f.apply(f.plan(['api', 'analyze', directory])); writeJson(path.join(directory, 'package.json'), {});
  assert.match(f.cli(['check', '--workspace', f.directory, '--local', '--strict'], { code: 1 }).stdout, /Source added: package.json/);
});
test('source refresh cannot acknowledge a stale document', t => {
  const f = fixture(t), directory = f.repo('api'), readme = path.join(directory, 'README.md'), guide = path.join(directory, 'docs/development.md');
  fs.mkdirSync(path.dirname(guide)); fs.writeFileSync(readme, 'Run old.py'); fs.writeFileSync(guide, 'Run old.py');
  const review = () => makePlan(f.directory, [['api', 'analyze', directory]], null, [], { reviews: [['api', 'docs/development.md']] });
  f.apply(review()); assert.deepEqual(f.check().warnings, []);
  fs.writeFileSync(readme, 'Run new.py'); f.apply(f.plan(['api', 'analyze', directory]));
  assert.equal(f.check().document_reviews[0].status, 'pending'); assert.match(f.check().warnings[0], /review inputs changed/);
  fs.writeFileSync(guide, 'Run new.py'); f.apply(review()); assert.deepEqual(f.check().warnings, []);
});
test('review plans recheck final document bytes', t => {
  const f = fixture(t), directory = f.repo('api'), guide = path.join(directory, 'AGENTS.md'); fs.writeFileSync(guide, 'Handwritten guidance\nGenerated link\n');
  const review = () => makePlan(f.directory, [['api', 'init', directory]], null, [], { reviews: [['api', 'AGENTS.md']] });
  const plan = review(); fs.writeFileSync(guide, 'Edited after preview\n'); assert.throws(() => f.apply(plan), /changed since preview/);
  f.apply(review()); assert.deepEqual(f.check().warnings, []);
});
test('explicit scripts are review inputs and register preserves baselines', t => {
  const f = fixture(t), directory = f.repo('api'); fs.writeFileSync(path.join(directory, 'start.sh'), 'original command'); fs.writeFileSync(path.join(directory, 'guide.md'), 'Run start.sh');
  f.apply(makePlan(f.directory, [['api', 'analyze', directory]], null, [], { sourceFiles: [['api', 'start.sh']], reviews: [['api', 'guide.md']] }));
  f.apply(f.plan(['api', 'register', directory])); fs.writeFileSync(path.join(directory, 'start.sh'), 'changed command');
  assert.equal(f.check().document_reviews[0].status, 'pending'); assert.ok(f.check().warnings.some(value => value.includes('start.sh')));
});
test('review rejects unavailable and malformed sources', t => {
  const f = fixture(t), directory = f.repo('api'); fs.writeFileSync(path.join(directory, 'guide.md'), 'Guide'); fs.writeFileSync(path.join(directory, 'package.json'), 'invalid json');
  assert.throws(() => makePlan(f.directory, [['api', 'analyze', directory]], null, [], { reviews: [['api', 'guide.md']] }), /malformed/);
  fs.unlinkSync(path.join(directory, 'package.json'));
  assert.throws(() => makePlan(f.directory, [['api', 'analyze', directory]], null, [], { sourceFiles: [['api', 'missing.sh']], reviews: [['api', 'guide.md']] }), /unavailable/);
});
test('strict check requires local inspection', t => {
  const f = fixture(t); f.apply(f.plan()); assert.match(f.cli(['check', '--workspace', f.directory, '--strict'], { code: 1 }).stderr, /requires --local/);
});
test('component ordering rejects cycles while descriptive edges may cycle', () => {
  const manifest = { schema_version: 1, language: 'en', members: [{ id: 'service', mode: 'register' }],
    components: [{ id: 'api', member: 'service', path: 'apps/api' }, { id: 'worker', member: 'service', path: 'apps/worker' }],
    relationships: [{ from: 'worker', to: 'api', type: 'starts_after' }, { from: 'worker', to: 'api', type: 'consumes' }, { from: 'api', to: 'worker', type: 'consumes' }],
    capabilities: [{ id: 'greeting', requires: ['api', 'worker'] }] };
  assert.deepEqual(componentModel(manifest, validateManifest(manifest)).orders.starts_after, ['api', 'worker']);
  manifest.relationships.push({ from: 'api', to: 'worker', type: 'starts_after' }); assert.throws(() => validateManifest(manifest), /Cycle in starts_after/);
});
test('component paths and capability references are validated', () => {
  const manifest = { schema_version: 1, language: 'en', members: [{ id: 'api', mode: 'register' }], capabilities: [{ id: 'greeting', requires: ['missing'] }] };
  assert.throws(() => validateManifest(manifest), /Unknown component/); delete manifest.capabilities;
  manifest.components = [{ id: 'web', member: 'api', path: '../outside' }]; assert.throws(() => validateManifest(manifest), /relative file/);
});
test('registry handles IDs that coincide with Object prototype keys', t => {
  const f = fixture(t), directory = f.repo('api'); f.apply(f.plan(['constructor', 'analyze', directory])); assert.deepEqual(f.check().members, ['constructor']);
});
test('remote normalization omits credentials and respects nondefault ports', () => {
  assert.equal(normalizedRemote('ssh://git@example.invalid:2222/team/repo.git'), 'example.invalid:2222/team/repo');
  assert.equal(normalizedRemote('git@example.invalid:team/repo.git'), 'example.invalid/team/repo');
  assert.equal(normalizedRemote('file:///private/repo'), null);
});
test('explicit null collections and invalid full-string identifiers remain invalid', () => {
  const base = { schema_version: 1, language: 'en', members: [{ id: 'api', mode: 'register' }] };
  for (const field of ['components', 'relationships', 'capabilities', 'documents']) {
    const manifest = structuredClone(base); manifest[field] = null; assert.throws(() => validateManifest(manifest), /must be a list/);
  }
  for (const field of ['documents', 'sources', 'source_files', 'document_reviews', 'depends_on']) {
    const manifest = structuredClone(base); manifest.members[0][field] = null; assert.throws(() => validateManifest(manifest), /must be a list/);
  }
  const manifest = structuredClone(base); manifest.members[0].id += '\n'; assert.throws(() => validateManifest(manifest), /Invalid member ID/);
});
