import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Binding } from '../core/types.js';
import { requireWorkspace } from '../core/registry.js';
import { resolvePath, stat } from './files.js';
export interface Checkout extends Binding { kind: 'checkout' | 'submodule' | 'worktree'; branch: string | null; head: string | null; remote: string | null; harness: boolean }
export function git(directory: string, ...args: string[]): string | null {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
  for (const key of ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_PREFIX']) delete (env as NodeJS.ProcessEnv)[key];
  const result = spawnSync('git', ['-C', directory, ...args], { env, encoding: 'utf8', timeout: 15000, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  return result.status === 0 ? result.stdout.replace(/\n+$/, '') : null;
}
export function normalizedRemote(value: string | null): string | null {
  if (!value) return null;
  let host: string, remotePath: string;
  if (value.includes('://')) {
    try {
      const url = new URL(value), protocol = url.protocol.slice(0, -1);
      if (!['http', 'https', 'ssh', 'git'].includes(protocol) || !url.hostname) return null;
      host = url.hostname.toLowerCase();
      const defaults: Record<string, string> = { http: '80', https: '443', ssh: '22', git: '9418' };
      if (url.port && url.port !== defaults[protocol]) host += `:${url.port}`;
      remotePath = url.pathname;
    } catch { return null; }
  } else {
    const match = /^(?:[^@:/]+@)?([^:/]+):([^?#]+)(?:[?#].*)?$/.exec(value);
    if (!match) return null;
    host = match[1].toLowerCase(); remotePath = match[2];
  }
  remotePath = remotePath.replace(/^\/+|\/+$/g, '').replace(/\.git$/, '');
  if (!remotePath || remotePath.split('/').some(part => ['', '.', '..'].includes(part))) return null;
  return `${host}/${remotePath}`;
}
export function checkout(directory: string): Checkout {
  const rootValue = stat(directory)?.isDirectory() ? git(directory, 'rev-parse', '--show-toplevel') : null;
  requireWorkspace(rootValue, `Not a Git working directory: ${directory}`);
  const root = resolvePath(rootValue), commonValue = git(root, 'rev-parse', '--git-common-dir');
  requireWorkspace(commonValue, `Could not determine the Git repository identity: ${root}`);
  const common = resolvePath(path.resolve(root, commonValue));
  const superproject = git(root, 'rev-parse', '--show-superproject-working-tree'), gitDir = git(root, 'rev-parse', '--absolute-git-dir');
  const kind = superproject ? 'submodule' : gitDir && resolvePath(gitDir) !== common ? 'worktree' : 'checkout';
  return { path: root, git_common_dir: common, kind, branch: git(root, 'symbolic-ref', '--quiet', '--short', 'HEAD'),
    head: git(root, 'rev-parse', '--verify', 'HEAD'), remote: normalizedRemote(git(root, 'config', '--get', 'remote.origin.url')),
    harness: ['AGENTS.md', 'CLAUDE.md'].some(name => stat(path.join(root, name))?.isFile()) };
}
