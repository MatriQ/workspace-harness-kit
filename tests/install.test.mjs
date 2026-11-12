import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Installer, checkInstallation, inventory, InstallError } from '../dist/install.js';
import { ROOT, temporary, run } from './helpers.mjs';

function fixture(t) {
  const root = temporary(t), destination = path.join(root, 'skills');
  return { root, destination, installer: new Installer(ROOT) };
}
function syntheticPackage(root) {
  const pkg = path.join(root, 'package'), source = path.join(pkg, 'skills/harness-fixture'); fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, 'SKILL.md'), 'Version one'); fs.writeFileSync(path.join(source, 'reference.txt'), 'Supporting resource');
  fs.writeFileSync(path.join(pkg, 'VERSION'), '1.0.0');
  return { pkg, source, installer: new Installer(pkg) };
}
test('complete install is idempotent and installed bundles execute in isolation', t => {
  const { destination, installer } = fixture(t);
  assert.equal(installer.apply(installer.plan(destination)).installed.length, 5);
  assert.ok(fs.existsSync(path.join(destination, 'harness-init/scripts/workspace.mjs')));
  assert.ok(fs.existsSync(path.join(destination, 'harness-verify-release/scripts/THIRD-PARTY-NOTICES.txt')));
  assert.deepEqual(checkInstallation(destination).problems, []); assert.deepEqual(installer.apply(installer.plan(destination)).changed, []);
  const skill = path.join(destination, 'harness-verify-release');
  assert.equal(JSON.parse(run(path.join(skill, 'scripts/evidence.mjs'), [path.join(skill, 'assets/example-release.json'), '--at', '2026-01-01T12:00:00Z'], { cwd: destination, env: { PATH: path.dirname(process.execPath) } }).stdout).verdict, 'passed');
  run(path.join(destination, 'harness-init/scripts/workspace.mjs'), ['--help'], { cwd: destination, env: { PATH: path.dirname(process.execPath) } });
});
test('unowned destination content is preserved', t => {
  const { destination, installer } = fixture(t), folder = path.join(destination, 'harness-guide'); fs.mkdirSync(folder, { recursive: true });
  const custom = path.join(folder, 'SKILL.md'); fs.writeFileSync(custom, 'User content');
  const plan = installer.plan(destination, ['harness-guide']); assert.ok(plan.conflicts.length);
  assert.throws(() => installer.apply(plan), InstallError); assert.equal(fs.readFileSync(custom, 'utf8'), 'User content');
});
test('edits after preview invalidate installation and remain intact', t => {
  const { destination, installer } = fixture(t); installer.apply(installer.plan(destination, ['harness-guide']));
  const plan = installer.plan(destination, ['harness-guide']), custom = path.join(destination, 'harness-guide/SKILL.md'); fs.writeFileSync(custom, 'Local customization');
  assert.throws(() => installer.apply(plan), /changed after preview/); assert.equal(fs.readFileSync(custom, 'utf8'), 'Local customization');
  assert.ok(checkInstallation(destination).problems.length);
});
test('receipt write failure restores the previous installation', t => {
  const { destination, installer } = fixture(t); installer.apply(installer.plan(destination, ['harness-guide']));
  const before = inventory(destination), plan = installer.plan(destination, ['harness-init']), rename = fs.renameSync;
  const stub = t.mock.method(fs, 'renameSync', (source, target) => { if (path.basename(target) === '.workspace-harness-kit-install.json') throw new Error('Synthetic receipt failure'); return rename(source, target); });
  assert.throws(() => installer.apply(plan), /Synthetic/); stub.mock.restore(); assert.deepEqual(inventory(destination), before);
});
test('symlinked Skills and destination are rejected', t => {
  const { root, destination, installer } = fixture(t); fs.mkdirSync(destination); fs.symlinkSync(root, path.join(destination, 'harness-guide'));
  assert.throws(() => installer.plan(destination, ['harness-guide']), InstallError);
  fs.symlinkSync(destination, path.join(root, 'linked')); assert.throws(() => installer.plan(path.join(root, 'linked')), InstallError);
});
test('successful upgrades replace removed resources; failed upgrades restore old files', t => {
  const { root, destination } = fixture(t), { installer, source, pkg } = syntheticPackage(root);
  installer.apply(installer.plan(destination));
  fs.writeFileSync(path.join(source, 'SKILL.md'), 'Version two'); fs.unlinkSync(path.join(source, 'reference.txt'));
  fs.writeFileSync(path.join(source, 'replacement.txt'), 'New resource'); fs.writeFileSync(path.join(pkg, 'VERSION'), '2.0.0');
  const before = inventory(destination), plan = installer.plan(destination), rename = fs.renameSync;
  const stub = t.mock.method(fs, 'renameSync', (source, target) => { if (path.basename(target) === '.workspace-harness-kit-install.json') throw new Error('Synthetic receipt failure'); return rename(source, target); });
  assert.throws(() => installer.apply(plan), /Synthetic/); stub.mock.restore(); assert.deepEqual(inventory(destination), before);
  installer.apply(installer.plan(destination)); assert.equal(fs.existsSync(path.join(destination, 'harness-fixture/reference.txt')), false);
  assert.equal(fs.readFileSync(path.join(destination, 'harness-fixture/SKILL.md'), 'utf8'), 'Version two');
  assert.equal(checkInstallation(destination).skills['harness-fixture'], '2.0.0');
});
test('concurrent user edit during rollback is preserved alongside the backup', t => {
  const { root, destination } = fixture(t), { installer, source } = syntheticPackage(root); installer.apply(installer.plan(destination));
  fs.writeFileSync(path.join(source, 'SKILL.md'), 'Version two'); const rename = fs.renameSync;
  const stub = t.mock.method(fs, 'renameSync', (source, target) => {
    if (path.basename(target) === '.workspace-harness-kit-install.json') { fs.writeFileSync(path.join(destination, 'harness-fixture/SKILL.md'), 'Concurrent user edit'); throw new Error('Synthetic receipt failure'); }
    return rename(source, target);
  });
  assert.throws(() => installer.apply(installer.plan(destination)), /preserved current files/); stub.mock.restore();
  assert.equal(fs.readFileSync(path.join(destination, 'harness-fixture/SKILL.md'), 'utf8'), 'Concurrent user edit');
  const recoveries = fs.readdirSync(destination).filter(name => name.startsWith('.workspace-harness-kit-recovery-')); assert.equal(recoveries.length, 1);
  assert.equal(fs.readFileSync(path.join(destination, recoveries[0], 'harness-fixture.backup/SKILL.md'), 'utf8'), 'Version one');
});
test('additional and missing local files block upgrades; plans cannot change selection', t => {
  const { destination, installer } = fixture(t); installer.apply(installer.plan(destination, ['harness-guide']));
  fs.writeFileSync(path.join(destination, 'harness-guide/custom.md'), 'local'); assert.ok(installer.plan(destination, ['harness-guide']).conflicts.length);
  fs.unlinkSync(path.join(destination, 'harness-guide/custom.md')); fs.unlinkSync(path.join(destination, 'harness-guide/SKILL.md'));
  assert.ok(installer.plan(destination, ['harness-guide']).conflicts.length);
  const plan = installer.plan(destination, ['harness-init']); plan.entries = {}; assert.throws(() => installer.apply(plan), /changed after preview/);
});
test('source changes after preview and active locks reject installation', t => {
  const { root, destination } = fixture(t), { installer, source } = syntheticPackage(root), plan = installer.plan(destination);
  fs.writeFileSync(path.join(source, 'SKILL.md'), 'Version two'); assert.throws(() => installer.apply(plan), /changed after preview/);
  fs.mkdirSync(path.join(destination, '.workspace-harness-kit-install.lock'), { recursive: true }); assert.throws(() => installer.plan(destination), /locked/);
});
test('an installer-owned Python Skill upgrades to the Node bundle', t => {
  const { root, destination, installer } = fixture(t);
  const previous = path.join(root, 'previous'), skill = path.join(previous, 'skills/harness-init/scripts');
  fs.mkdirSync(skill, { recursive: true }); fs.writeFileSync(path.join(previous, 'VERSION'), '0.1.0');
  fs.writeFileSync(path.join(previous, 'skills/harness-init/SKILL.md'), 'Synthetic previous Skill');
  fs.writeFileSync(path.join(skill, 'workspace.py'), '# Synthetic previous runtime');
  new Installer(previous).apply(new Installer(previous).plan(destination));
  installer.apply(installer.plan(destination, ['harness-init']));
  assert.equal(fs.existsSync(path.join(destination, 'harness-init/scripts/workspace.py')), false);
  assert.equal(fs.existsSync(path.join(destination, 'harness-init/scripts/workspace.mjs')), true);
  assert.equal(checkInstallation(destination).skills['harness-init'], '0.2.0');
});
