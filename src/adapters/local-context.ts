import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { equal, isObject, json } from '../core/json.js';
import { DEFAULT_LOCAL_CONTEXT, LEGACY_LOCAL_CONTEXT, LOCAL_START, localContextPath, parseLocalContext, validateLocalContext } from '../core/local-context.js';
import type { Binding, LocalManifest, WorkspaceManifest } from '../core/types.js';
import { requireWorkspace, validateManifest } from '../core/registry.js';
import { expandUser, hash, readJson, resolvePath, stat, within } from './files.js';
import { checkout, git } from './git.js';

export { DEFAULT_LOCAL_CONTEXT, LEGACY_LOCAL_CONTEXT, localContextPath, parseLocalContext, renderLocalContext, validateLocalContext } from '../core/local-context.js';
export class MissingLocalContext extends Error { override name = 'MissingLocalContext'; }
export function machineFingerprint(): string { return hash(json([os.hostname(), os.platform(), os.arch(), os.homedir()])); }
function regular(root: string, relative: string): string {
  const file = within(root, relative), info = stat(file, false);
  requireWorkspace(!info || (info.isFile() && !info.isSymbolicLink()), `Local context must be a regular file: ${relative}`);
  requireWorkspace(!info || info.size <= 1024 * 1024, 'Local context exceeds the 1 MiB limit');
  return file;
}
export function assertPrivate(root: string, relative: string, requireIgnored = true): void {
  regular(root, relative);
  if (!git(root, 'rev-parse', '--show-toplevel')) return;
  const aliases = [...new Set([relative, path.relative(root, resolvePath(within(root, relative))).split(path.sep).join('/')])];
  for (const alias of aliases) {
    requireWorkspace(git(root, 'ls-files', '--error-unmatch', '--', alias) === null, `Untrack ${alias} before maintaining local context`);
    if (requireIgnored) requireWorkspace(git(root, 'check-ignore', '--quiet', '--', alias) !== null, `Git does not ignore local context: ${alias}`);
  }
}
export function localContextEntry(root: string, explicit?: string): string {
  const manifest = readJson(within(root, '.harness/workspace.json'), {});
  if (explicit !== undefined) return localContextPath(explicit);
  if (isObject(manifest) && manifest.local_context !== undefined) return localContextPath(manifest.local_context);
  const candidates: string[] = [];
  for (const folder of ['', '.harness/docs']) {
    const directory = folder ? within(root, folder) : root;
    if (!stat(directory)?.isDirectory()) continue;
    for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.local.md')).slice(0, 200)) {
      const relative = [folder, name].filter(Boolean).join('/');
      const file = regular(root, relative);
      if (fs.readFileSync(file, 'utf8').includes(LOCAL_START)) candidates.push(relative);
    }
  }
  requireWorkspace(candidates.length <= 1, 'Multiple local-context entries; choose --local-context explicitly');
  return candidates[0] ?? (stat(within(root, 'AGENTS.local.md')) ? 'AGENTS.local.md' : DEFAULT_LOCAL_CONTEXT);
}
function normalize(root: string, input: LocalManifest): LocalManifest {
  return { ...input, checkouts: Object.fromEntries(Object.entries(input.checkouts).map(([id, binding]) => [id, {
    path: resolvePath(path.resolve(root, expandUser(binding.path))), git_common_dir: resolvePath(path.resolve(root, expandUser(binding.git_common_dir)))
  }])) };
}
function merge(left: unknown, right: unknown, field = ''): unknown {
  if (left === undefined) return structuredClone(right);
  if (right === undefined || equal(left, right)) return structuredClone(left);
  if (isObject(left) && isObject(right)) return Object.fromEntries([...new Set([...Object.keys(left), ...Object.keys(right)])].map(key => [key, merge(left[key], right[key], field ? `${field}.${key}` : key)]));
  throw new Error(`Conflicting Markdown and legacy local-context field: ${field}; reconcile it before migration`);
}
export function readLocalContext(root: string, options: { file?: string; planning?: boolean } = {}) {
  root = resolvePath(root);
  const relative = localContextEntry(root, options.file), file = regular(root, relative), legacy = regular(root, LEGACY_LOCAL_CONTEXT);
  const markdown = stat(file) ? fs.readFileSync(file, 'utf8') : '';
  if (stat(file)) assertPrivate(root, relative, !options.planning);
  if (stat(legacy)) assertPrivate(root, LEGACY_LOCAL_CONTEXT, !options.planning);
  const parsed = parseLocalContext(markdown);
  let old: LocalManifest | undefined;
  if (stat(legacy)) {
    const input = readJson(legacy);
    if (isObject(input)) {
      const fields = ['schema_version', 'checkouts', 'machine', 'tools', 'environment', 'access', 'execution', 'state', 'onboarding_status'];
      const extra = Object.fromEntries(Object.entries(input).filter(([key]) => !fields.includes(key)));
      for (const key of Object.keys(extra)) delete input[key];
      if (Object.keys(extra).length) input.state = { ...(isObject(input.state) ? input.state : {}), legacy_fields: extra };
    }
    validateLocalContext(input); old = normalize(root, input);
  }
  const data = merge(parsed ? normalize(root, parsed) : undefined, old) as LocalManifest | undefined;
  return { path: relative, markdown, data: data ?? { schema_version: 1 as const, checkouts: {} },
    format: parsed ? 'markdown' as const : old ? 'legacy-json' as const : 'missing' as const,
    legacy: old ? LEGACY_LOCAL_CONTEXT : null, machine_matches: !data?.machine || data.machine === machineFingerprint() };
}
export function checkedBindings(root: string): Record<string, Binding> {
  const context = readLocalContext(root);
  return Object.fromEntries(Object.keys(context.data.checkouts).map(id => [id, memberBinding(root, id)]));
}
export function memberBinding(root: string, id: string): Binding {
  const context = readLocalContext(root);
  if (!context.machine_matches) throw new MissingLocalContext('Local context belongs to another machine; rebind and verify readiness');
  const members = validateManifest(readJson(within(root, '.harness/workspace.json')));
  requireWorkspace(Object.hasOwn(members, id), `Unregistered source member: ${id}`);
  const binding = context.data.checkouts[id];
  if (!binding) throw new MissingLocalContext(`Missing local checkout binding: ${id}; run workspace plan --member ${id} MODE PATH, then apply`);
  if (!stat(binding.path)?.isDirectory()) throw new MissingLocalContext(`Local checkout is unavailable: ${id}; supply its current path and rebind`);
  const actual = checkout(binding.path);
  requireWorkspace(actual.path === binding.path && actual.git_common_dir === binding.git_common_dir && actual.remote === (members[id].remote ?? null), `Local checkout identity differs for ${id}; inspect and rebind it`);
  return binding;
}
export function localBindingFingerprint(root: string): string {
  const context = readLocalContext(root);
  const identity = Object.fromEntries(Object.entries(context.data.checkouts).map(([id, binding]) => {
    const info = stat(binding.git_common_dir);
    return [id, { ...binding, head: git(binding.path, 'rev-parse', '--verify', 'HEAD'), branch: git(binding.path, 'symbolic-ref', '--quiet', '--short', 'HEAD'), ...(info ? { device: info.dev, inode: info.ino } : {}) }];
  }));
  return hash(json({ machine: machineFingerprint(), recorded_machine: context.data.machine ?? null, checkouts: identity,
    tools: context.data.tools ?? {}, environment: context.data.environment ?? {}, access: context.data.access ?? {} }));
}
export function localContextReport(root: string) {
  const context = readLocalContext(root), manifest = readJson(within(root, '.harness/workspace.json'), {}) as WorkspaceManifest;
  const bindings: Record<string, Binding> = {}, errors: string[] = [], pending: string[] = [];
  if (context.machine_matches) for (const id of Object.keys(context.data.checkouts)) {
    try { bindings[id] = memberBinding(root, id); } catch (error) { (error instanceof MissingLocalContext ? pending : errors).push((error as Error).message); }
  }
  const missing = (manifest.members ?? []).map(member => member.id).filter(id => !bindings[id]);
  return { status: errors.length ? 'failed' : context.machine_matches && !missing.length && context.format === 'markdown' ? 'available' : 'pending',
    errors, pending, readiness: 'not established by local context availability', path: context.path, format: context.format, machine_matches: context.machine_matches, missing,
    binding_sha256: localBindingFingerprint(root), data: context.data,
    next_action: context.format === 'legacy-json' ? 'Preview/apply workspace migration to *.local.md; legacy input is read-only' : missing.length || !context.machine_matches ? 'Rebind selected checkouts and verify local tools, access and execution on this machine' : null };
}
