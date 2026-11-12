import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const WORKSPACE = path.join(ROOT, 'skills/harness-init/scripts/workspace.mjs');
export const EVIDENCE = path.join(ROOT, 'skills/harness-verify-release/scripts/evidence.mjs');
export function temporary(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'whk-test-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root;
}
export function run(script, args = [], { code = 0, cwd, env } = {}) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, env, encoding: 'utf8', timeout: 20000, maxBuffer: 4 * 1024 * 1024 });
  assert.ifError(result.error); assert.equal(result.status, code, result.stderr + result.stdout); return result;
}
export function git(directory, ...args) {
  const result = spawnSync('git', ['-c', `core.hooksPath=${os.devNull}`, '-C', directory, ...args], { encoding: 'utf8', timeout: 15000 });
  assert.ifError(result.error); assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
}
export function repo(root, name, remote) {
  const directory = path.join(root, name); fs.mkdirSync(directory, { recursive: true });
  git(directory, 'init', '--initial-branch=main', '--template=');
  if (remote) git(directory, 'remote', 'add', 'origin', remote);
  return directory;
}
export function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2)); }
export function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
export function sample() { return readJson(path.join(ROOT, 'skills/harness-verify-release/assets/example-release.json')); }
export const AT = '2026-01-01T12:00:00+00:00';
