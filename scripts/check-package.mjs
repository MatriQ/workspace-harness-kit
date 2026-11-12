import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'whk-package-')));
function run(command, args, cwd = temporary, expected = 0) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
  assert.ifError(result.error); assert.equal(result.status, expected, result.stderr + result.stdout); return result.stdout;
}
try {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  // Build once, then inspect the exact tarball installed in a clean consumer directory.
  run(npm, ['run', 'build'], root);
  const [packed] = JSON.parse(run(npm, ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], root));
  assert.ok(!packed.files.some(item => /^(skills|scripts|evals)\/.*\.py$/.test(item.path)), 'Package retained a Python helper');
  const consumer = path.join(temporary, 'consumer'); fs.mkdirSync(consumer);
  fs.writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  run(npm, ['install', '--ignore-scripts', '--omit=dev', '--offline', '--no-audit', '--no-fund', path.join(temporary, packed.filename)], consumer);
  const pkg = path.join(consumer, 'node_modules/workspace-harness-kit'), bin = path.join(consumer, 'node_modules/.bin/whk');
  assert.equal(run(bin, ['--version'], consumer).trim(), JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version);
  const sample = path.join(pkg, 'skills/harness-verify-release/assets/example-release.json');
  assert.equal(JSON.parse(run(bin, ['evidence', sample, '--at', '2026-01-01T12:00:00Z'], consumer)).verdict, 'passed');
  fs.writeFileSync(path.join(consumer, 'verify.mjs'), `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluate, validateManifest, planOnboarding, validateHarnessSpec, renderHarness } from 'workspace-harness-kit';
import { inspectToolchain } from 'workspace-harness-kit/onboarding';
import { makeHarnessPlan, applyHarnessPlan } from 'workspace-harness-kit/harness';
import { checkHarness } from 'workspace-harness-kit/harness-check';
import { harnessDoctor } from 'workspace-harness-kit/harness-doctor';
import { harnessImpact, harnessSync } from 'workspace-harness-kit/harness-impact';
import { evaluateReadiness } from 'workspace-harness-kit/readiness';
import { discover } from 'workspace-harness-kit/workspace';
import { junit, ecsVersion } from 'workspace-harness-kit/collect';
import { Installer } from 'workspace-harness-kit/install';
const record = JSON.parse(readFileSync(process.argv[2], 'utf8'));
assert.equal(evaluate(record, '2026-01-01T12:00:00Z').verdict, 'passed');
assert.deepEqual(validateManifest({schema_version:1, language:'en', members:[]}), {});
assert.equal(planOnboarding({schema_version:1}).status, 'needs-input');
assert.equal(inspectToolchain({schema_version:1}, () => { throw new Error('Unexpected probe'); }).status, 'pending');
assert.equal(typeof discover, 'function'); assert.equal(typeof Installer, 'function');
assert.equal(typeof validateHarnessSpec, 'function'); assert.equal(typeof renderHarness, 'function');
assert.equal(typeof makeHarnessPlan, 'function'); assert.equal(typeof applyHarnessPlan, 'function'); assert.equal(typeof checkHarness, 'function');
assert.equal(junit('<testsuite tests="1"><testcase/></testsuite>').status, 'passed');
assert.equal(typeof harnessDoctor, 'function'); assert.equal(typeof harnessImpact, 'function'); assert.equal(typeof harnessSync, 'function');
assert.equal(typeof evaluateReadiness, 'function'); assert.equal(typeof ecsVersion, 'function');
`);
  run(process.execPath, [path.join(consumer, 'verify.mjs'), sample], consumer);
  fs.writeFileSync(path.join(consumer, 'types.ts'), `
import { evaluate, planOnboarding, renderHarness, type HarnessSpec, type EvidenceRecord, type EvaluationResult, type OnboardingProfile, type OnboardingPlan } from 'workspace-harness-kit';
import { inspectToolchain, type ToolProbe, type ToolchainInspection } from 'workspace-harness-kit/onboarding';
import { makeHarnessPlan, applyHarnessPlan, type HarnessPlan } from 'workspace-harness-kit/harness';
import { checkHarness } from 'workspace-harness-kit/harness-check';
import { harnessDoctor } from 'workspace-harness-kit/harness-doctor';
import { harnessImpact, harnessSync } from 'workspace-harness-kit/harness-impact';
import { evaluateReadiness } from 'workspace-harness-kit/readiness';
import { makePlan } from 'workspace-harness-kit/workspace';
import { versionHttp } from 'workspace-harness-kit/collect';
import { Installer } from 'workspace-harness-kit/install';
declare const record: EvidenceRecord;
const result: EvaluationResult = evaluate(record);
const plan = makePlan('/synthetic');
const profile: OnboardingProfile = { schema_version: 1, activities: { operations: true } };
const onboarding: OnboardingPlan = planOnboarding(profile);
const probe: ToolProbe = tool => ({ status: 0, stdout: tool.id, stderr: '' });
const inspection: ToolchainInspection = inspectToolchain(profile, probe);
const authentication: 'not run' = inspection.authentication;
void authentication; void onboarding;
const installer = new Installer('/synthetic');
void result; void plan; void installer; void versionHttp;
declare const spec: HarnessSpec;
const harnessPlan: HarnessPlan = makeHarnessPlan('/synthetic', spec, { adopt: ['AGENTS.md'] });
void applyHarnessPlan(harnessPlan); void checkHarness('/synthetic');
void renderHarness(spec, { check: '', hook: '', notices: '' });
void harnessDoctor('/synthetic', { run: ['smoke'] }); void harnessImpact('/synthetic'); void harnessSync('/synthetic'); void evaluateReadiness;
// @ts-expect-error: typo must be rejected by the public contract type.
const invalid: EvidenceRecord['observations'][number]['status'] = 'success';
// @ts-expect-error: missing answers must be omitted, not serialized as null.
const invalidActivity: OnboardingProfile['activities'] = { deployment: null };
// @ts-expect-error: native output targets are an explicit supported union.
const invalidTargets: HarnessSpec['targets'] = ['unknown-host'];
`);
  fs.writeFileSync(path.join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
    strict: true, module: 'NodeNext', target: 'ES2024', noEmit: true,
    types: ['node'], typeRoots: [path.join(root, 'node_modules/@types')],
  }, files: ['types.ts'] }));
  run(path.join(root, 'node_modules/.bin/tsc'), ['--project', path.join(consumer, 'tsconfig.json')], consumer);
  const destination = path.join(temporary, 'installed'), plan = path.join(temporary, 'install-plan.json');
  fs.writeFileSync(plan, run(bin, ['install', 'plan', '--destination', destination], consumer));
  run(bin, ['install', 'apply', '--plan', plan], consumer); run(bin, ['install', 'check', '--destination', destination], consumer);
  const setup = JSON.parse(run(bin, ['install', 'setup', '--destination', destination], consumer));
  assert.deepEqual(setup.installations[0].changed, []);
  const bootstrap = JSON.parse(run('bash', [path.join(pkg, 'install.sh'), '--source', pkg,
    '--destination', path.join(temporary, 'bootstrap-skills'), '--skill', 'harness-init'], consumer));
  assert.deepEqual(bootstrap.installations[0].installed, ['harness-init']);
  assert.deepEqual(bootstrap.installations[0].problems, []);
  const workspace = path.join(temporary, 'coordinator'); fs.mkdirSync(workspace);
  fs.writeFileSync(path.join(workspace, 'README.md'), '# Greeting services\n\nAn API, client and worker form a synthetic greeting journey. Hosted deployment is not configured. Shared-history rewrites are excluded by this synthetic team.\n');
  const harnessPlan = path.join(temporary, 'harness-plan.json');
  const harnessSpec = path.join(pkg, 'skills/harness-init/assets/harness-complete.json');
  fs.writeFileSync(harnessPlan, run(bin, ['harness', 'plan', '--workspace', workspace, '--spec', harnessSpec], consumer));
  assert.deepEqual(JSON.parse(fs.readFileSync(harnessPlan, 'utf8')).conflicts, []);
  run(bin, ['harness', 'apply', '--plan', harnessPlan], consumer);
  assert.equal(JSON.parse(run(bin, ['harness', 'check', '--workspace', workspace, '--local'], consumer)).status, 'passed');
  assert.equal(JSON.parse(run(bin, ['harness', 'doctor', '--workspace', workspace], consumer, 2)).status, 'pending');
  assert.equal(JSON.parse(run(bin, ['harness', 'sync', '--workspace', workspace], consumer)).writes, 0);
  // Remove the entire npm consumer: installed Skills must have no hidden package dependency.
  fs.rmSync(consumer, { recursive: true });
  const installedInit = path.join(destination, 'harness-init');
  const onboarding = JSON.parse(run(process.execPath, [path.join(installedInit, 'scripts/onboarding.mjs'),
    'plan', path.join(installedInit, 'assets/onboarding-aws.json')]));
  assert.equal(onboarding.status, 'planned');
  assert.deepEqual(onboarding.tools.map(tool => tool.id), ['aws', 'gh']);
  assert.ok(onboarding.platform_guides.every(guide => fs.existsSync(path.join(installedInit, guide.reference))));
  const generator = path.join(installedInit, 'scripts/harness.mjs');
  fs.writeFileSync(harnessPlan, run(process.execPath, [generator, 'plan', '--workspace', workspace,
    '--spec', path.join(installedInit, 'assets/harness-complete.json')]));
  assert.deepEqual(JSON.parse(run(process.execPath, [generator, 'apply', '--plan', harnessPlan])).written, []);
  assert.equal(JSON.parse(run(process.execPath, [generator, 'check', '--workspace', workspace, '--local'])).status, 'passed');
  assert.equal(JSON.parse(run(process.execPath, [generator, 'doctor', '--workspace', workspace], temporary, 2)).status, 'pending');
  assert.equal(JSON.parse(run(process.execPath, [generator, 'impact', '--workspace', workspace])).affected.length, 0);
  const installed = path.join(destination, 'harness-verify-release');
  assert.equal(JSON.parse(run(process.execPath, [path.join(installed, 'scripts/readiness.mjs'), '--plan', path.join(installed, 'assets/example-readiness.json')], temporary, 2)).decision, 'pending');
  assert.equal(JSON.parse(run(process.execPath, [path.join(installed, 'scripts/evidence.mjs'), path.join(installed, 'assets/example-release.json'), '--at', '2026-01-01T12:00:00Z'])).verdict, 'passed');
  const sampleRecord = JSON.parse(fs.readFileSync(path.join(installed, 'assets/example-release.json'), 'utf8'));
  fs.writeFileSync(path.join(temporary, 'target.json'), JSON.stringify(sampleRecord.scope.target));
  fs.writeFileSync(path.join(temporary, 'artifact.json'), JSON.stringify(sampleRecord.scope.components[0].artifact));
  fs.writeFileSync(path.join(temporary, 'junit.xml'), '<testsuite tests="1"><testcase/></testsuite>');
  assert.equal(JSON.parse(run(process.execPath, [path.join(installed, 'scripts/collect.mjs'), 'junit', '--component', 'api', '--attempt', '1',
    '--input', path.join(temporary, 'junit.xml'), '--target', path.join(temporary, 'target.json'), '--artifact', path.join(temporary, 'artifact.json'), '--observed-at', '2026-01-01T12:00:00Z'])).status, 'passed');
  fs.rmSync(destination, { recursive: true });
  const detached = JSON.parse(run(process.execPath, [path.join(workspace, '.harness/runtime/check.mjs'), '--workspace', workspace]));
  assert.equal(detached.status, 'passed'); assert.equal(detached.hook_cases.length, 4);
  console.log('Packed CLI, typed library exports, offline consumer install, detached Skills, and generated harness runtimes passed.');
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
