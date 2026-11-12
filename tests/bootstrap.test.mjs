import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT, temporary, repo, git } from './helpers.mjs';

function fixture(t) {
  const root = temporary(t), source = repo(root, 'source with spaces');
  fs.mkdirSync(path.join(source, 'scripts'));
  fs.copyFileSync(path.join(ROOT, 'scripts/install.mjs'), path.join(source, 'scripts/install.mjs'));
  fs.mkdirSync(path.join(source, 'skills/harness-fixture'), { recursive: true });
  fs.writeFileSync(path.join(source, 'VERSION'), '1.0.0');
  fs.writeFileSync(path.join(source, 'skills/harness-fixture/SKILL.md'), 'Version one');
  function commit() {
    git(source, 'add', '.');
    git(source, '-c', 'user.name=Synthetic Fixture', '-c', 'user.email=fixture@example.test', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Synthetic installer source');
    return git(source, 'rev-parse', 'HEAD');
  }
  const initial = commit(), destination = path.join(root, 'installed skills'), downloads = path.join(root, 'downloads');
  fs.mkdirSync(downloads);
  // Exercise the real Git download path offline, including branch and commit selection.
  const env = { ...process.env, TMPDIR: downloads, GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: `url.${pathToFileURL(source).href}.insteadOf`,
    GIT_CONFIG_VALUE_0: 'https://github.com/MatriQ/workspace-harness-kit.git' };
  function bootstrap(args = [], expected = 0, overrides = {}) {
    const result = spawnSync('/bin/bash', ['-s', '--', ...args], { input: fs.readFileSync(path.join(ROOT, 'install.sh'), 'utf8'),
      cwd: root, env: { ...env, ...overrides }, encoding: 'utf8', timeout: 20000 });
    assert.ifError(result.error); assert.equal(result.status, expected, result.stderr + result.stdout);
    assert.deepEqual(fs.readdirSync(downloads), [], 'Temporary downloads must be cleaned on success and failure');
    return result;
  }
  return { root, source, initial, destination, commit, bootstrap };
}

test('bootstrap downloads, repeats, upgrades and installs a pinned commit', t => {
  const f = fixture(t), args = ['--destination', f.destination];
  const first = JSON.parse(f.bootstrap(args).stdout);
  assert.equal(first.installations[0].version, '1.0.0');
  assert.deepEqual(JSON.parse(f.bootstrap(args).stdout).installations[0].changed, []);
  fs.writeFileSync(path.join(f.source, 'VERSION'), '2.0.0');
  fs.writeFileSync(path.join(f.source, 'skills/harness-fixture/SKILL.md'), 'Version two');
  f.commit();
  assert.equal(JSON.parse(f.bootstrap(args).stdout).installations[0].version, '2.0.0');
  assert.equal(fs.readFileSync(path.join(f.destination, 'harness-fixture/SKILL.md'), 'utf8'), 'Version two');
  const pinned = path.join(f.root, 'pinned');
  assert.equal(JSON.parse(f.bootstrap(['--ref', f.initial, '--destination', pinned]).stdout).installations[0].version, '1.0.0');
});

test('bootstrap preview and a conflicting installation preserve destination files', t => {
  const f = fixture(t), args = ['--destination', f.destination];
  assert.equal(JSON.parse(f.bootstrap([...args, '--dry-run']).stdout).dry_run, true);
  assert.equal(fs.existsSync(f.destination), false);
  f.bootstrap(args);
  const custom = path.join(f.destination, 'harness-fixture/SKILL.md'); fs.writeFileSync(custom, 'Local customization');
  assert.match(f.bootstrap(args, 1).stderr, /local files changed/);
  assert.equal(fs.readFileSync(custom, 'utf8'), 'Local customization');
  assert.match(f.bootstrap(['--ref', 'missing-branch', ...args], 128).stderr, /remote ref/);
});

test('bootstrap runs a local checkout and rejects invalid inputs or an old Node runtime', t => {
  const f = fixture(t);
  assert.equal(JSON.parse(f.bootstrap(['--source', f.source, '--destination', f.destination]).stdout).installations[0].version, '1.0.0');
  assert.match(f.bootstrap(['--source'], 1).stderr, /needs a value/);
  assert.match(f.bootstrap(['--ref', '-invalid'], 1).stderr, /Expected a Git/);
  assert.match(f.bootstrap(['--source', f.source, '--ref', 'main'], 1).stderr, /either --ref or --source/);
  const bin = path.join(f.root, 'old-runtime'); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'node'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const target = path.join(f.root, 'untouched');
  assert.match(f.bootstrap(['--destination', target], 1, { PATH: `${bin}:${process.env.PATH}` }).stderr, /Node.js 24\+/);
  assert.equal(fs.existsSync(target), false);
});
