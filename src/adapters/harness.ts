import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { equal, isObject, json } from '../core/json.js';
import { HARNESS_PARTS, harnessConfiguration, harnessDocumentRoot, harnessPath, renderHarness, requireHarness, validateHarnessSpec } from '../core/harness.js';
import type { GeneratedArtifact, HarnessRuntimes, HarnessSpec } from '../core/harness.js';
import { atomicWrite, fileHash, hash, readJson, resolvePath, stat, within } from './files.js';

export const HARNESS_RECEIPT = '.harness/generated.json';
export const HARNESS_SPEC = '.harness/harness.json';
const START = '<!-- workspace-harness-kit:configuration:start -->', END = '<!-- workspace-harness-kit:configuration:end -->';
interface SourceStamp { member?: string; path: string; sha256: string }
export interface HarnessFileRecord { path: string; logical_paths: string[]; kind: string; sha256: string; executable: boolean; owns_file: boolean; symlink_target?: string; managed_sha256?: string; settings_patch?: Record<string, unknown> }
export interface HarnessReceipt { schema_version: 1; profile_sha256: string | null; sources: SourceStamp[]; files: HarnessFileRecord[] }
interface PlannedFile extends HarnessFileRecord { before: string | null; before_mode: number | null; before_link?: string | null; mode: number; content: string; action: 'create' | 'merge' | 'update' | 'unchanged' }
export interface HarnessPlan {
  schema_version: 1; workspace: string; spec: HarnessSpec; adopt: string[];
  before: Record<string, string | null>; files: PlannedFile[]; conflicts: Array<{ path: string; reason: string }>;
  receipt: HarnessReceipt; activation: 'not run';
}
export function currentProfileHash(root: string): string | null {
  const manifest = readJson(within(root, '.harness/workspace.json'), {});
  return isObject(manifest) && manifest.onboarding ? hash(json(manifest.onboarding)) : null;
}
export function sourcePath(root: string, source: { member?: string; path: string }): string {
  if (!source.member) return within(root, source.path);
  const manifest = readJson(within(root, '.harness/workspace.json'));
  requireHarness(isObject(manifest) && Array.isArray(manifest.members) && manifest.members.some(member => isObject(member) && member.id === source.member), `Unregistered source member: ${source.member}`);
  const local = readJson(within(root, '.harness/workspace.local.json'));
  const bindings = isObject(local) && isObject(local.checkouts) ? local.checkouts : {};
  const binding = bindings[source.member];
  requireHarness(isObject(binding) && typeof binding.path === 'string', `Missing source binding: ${source.member}`);
  return within(resolvePath(binding.path), source.path);
}
export function readHarnessReceipt(root: string): HarnessReceipt | undefined {
  const file = within(root, HARNESS_RECEIPT);
  if (!stat(file)) return undefined;
  const receipt = readJson(file);
  requireHarness(isObject(receipt) && receipt.schema_version === 1 && Array.isArray(receipt.files) && Array.isArray(receipt.sources), 'Invalid generated harness receipt');
  const paths = new Set<string>();
  for (const record of receipt.files) {
    requireHarness(isObject(record), 'Invalid generated file record'); harnessPath(record.path);
    requireHarness(!paths.has(record.path), 'Repeated generated file record'); paths.add(record.path);
    requireHarness(typeof record.sha256 === 'string' && /^[a-f0-9]{64}$/.test(record.sha256), 'Invalid generated hash');
    requireHarness(Array.isArray(record.logical_paths) && record.logical_paths.length > 0, 'Missing logical file paths');
    for (const alias of record.logical_paths) harnessPath(alias);
    requireHarness(typeof record.executable === 'boolean' && typeof record.owns_file === 'boolean' && typeof record.kind === 'string', 'Invalid file metadata');
    if ('managed_sha256' in record) requireHarness(typeof record.managed_sha256 === 'string' && /^[a-f0-9]{64}$/.test(record.managed_sha256), 'Invalid managed block hash');
    if ('settings_patch' in record) requireHarness(isObject(record.settings_patch), 'Invalid managed settings patch');
    if ('symlink_target' in record) requireHarness(record.symlink_target === 'AGENTS.md' && record.path === 'CLAUDE.md' && record.kind === 'entrypoint-alias', 'Invalid entry-point symlink record');
  }
  for (const source of receipt.sources) {
    requireHarness(isObject(source) && typeof source.sha256 === 'string' && /^[a-f0-9]{64}$/.test(source.sha256), 'Invalid source snapshot'); harnessPath(source.path);
    if ('member' in source) requireHarness(typeof source.member === 'string', 'Invalid source member');
  }
  requireHarness(receipt.profile_sha256 === null || (typeof receipt.profile_sha256 === 'string' && /^[a-f0-9]{64}$/.test(receipt.profile_sha256)), 'Invalid initialization fingerprint');
  return receipt as unknown as HarnessReceipt;
}
function merge(existing: unknown, desired: unknown, overwrite: boolean, key = ''): unknown {
  if (existing === undefined || equal(existing, desired)) return structuredClone(desired);
  if (Array.isArray(existing) && Array.isArray(desired)) return [...existing, ...desired.filter(item => !existing.some(old => equal(old, item)))];
  if (isObject(existing) && isObject(desired)) return Object.fromEntries([...new Set([...Object.keys(existing), ...Object.keys(desired)])].map(name => [name,
    Object.hasOwn(desired, name) ? merge(existing[name], desired[name], overwrite, key ? `${key}.${name}` : name) : existing[name]]));
  requireHarness(overwrite, `Existing setting differs at ${key}; review the merged value and adopt this file explicitly`);
  return structuredClone(desired);
}
function checkRetiredSettings(existing: unknown, previous: unknown, next: unknown, key = ''): void {
  if (Array.isArray(previous) && Array.isArray(existing)) {
    for (const value of previous) requireHarness((Array.isArray(next) && next.some(item => equal(item, value))) || !existing.some(item => equal(item, value)), `Retired generated setting remains at ${key}; reconcile it explicitly before refreshing`);
  } else if (isObject(previous) && isObject(existing)) {
    for (const [name, value] of Object.entries(previous)) checkRetiredSettings(existing[name], value, isObject(next) ? next[name] : undefined, key ? `${key}.${name}` : name);
  } else if (next === undefined && existing !== undefined) requireHarness(!equal(existing, previous), `Retired generated setting remains at ${key}; reconcile it explicitly before refreshing`);
}
function managedBlock(content: string): string | undefined {
  const first = content.indexOf(START), last = content.indexOf(END);
  if (first === -1 && last === -1) return undefined;
  requireHarness(first >= 0 && last > first && content.indexOf(START, first + START.length) === -1 && content.indexOf(END, last + END.length) === -1, 'Malformed or repeated harness markers');
  return content.slice(first, last + END.length);
}
function entrypoint(existing: string, desired: string): string {
  const block = `${START}\n${desired.trim()}\n${END}`, previous = managedBlock(existing);
  return previous ? existing.replace(previous, block) : existing + (existing && !existing.endsWith('\n') ? '\n' : '') + (existing ? '\n' : '') + block + '\n';
}
function tomlSettings(original: string, patch: Record<string, unknown>): string {
  const start = '# workspace-harness-kit:settings:start', end = '# workspace-harness-kit:settings:end';
  const first = original.indexOf(start), last = original.indexOf(end);
  requireHarness((first === -1 && last === -1) || (first >= 0 && last > first && original.indexOf(start, first + start.length) === -1 && original.indexOf(end, last + end.length) === -1), 'Malformed TOML settings markers');
  const block = first >= 0 ? original.slice(first, last + end.length) : '';
  const outside = block ? original.replace(block, '') : original;
  const existing = parseToml(outside), owned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (Object.hasOwn(existing, key)) requireHarness(equal(existing[key], value), `Existing setting differs at ${key}; reconcile the original key before generation`);
    else owned[key] = value;
  }
  if (!Object.keys(owned).length) return outside;
  const replacement = `${start}\n${stringifyToml(owned).trim()}\n${end}`;
  return block ? original.replace(block, replacement) : replacement + '\n' + original;
}
function runtimeFiles(): HarnessRuntimes {
  const folder = path.dirname(fileURLToPath(import.meta.url));
  const support = stat(path.join(folder, 'harness-check.mjs')) ? folder : path.resolve(folder, '../skills/harness-init/scripts');
  return { check: fs.readFileSync(path.join(support, 'harness-check.mjs'), 'utf8'), hook: fs.readFileSync(path.join(support, 'harness-hook.mjs'), 'utf8'), notices: fs.readFileSync(path.join(support, 'THIRD-PARTY-NOTICES.txt'), 'utf8') };
}
function state(root: string): Record<string, string | null> {
  return Object.fromEntries([HARNESS_RECEIPT, '.harness/workspace.json', '.harness/workspace.local.json'].map(name => {
    const file = within(root, name); return [name, stat(file) ? fileHash(file) : null];
  }));
}
function outputState(file: string) {
  const info = stat(file, false);
  const link = info?.isSymbolicLink() ? fs.readlinkSync(file) : null;
  return { info, link, digest: info ? link === null ? fileHash(file) : hash(link) : null };
}
function atomicSymlink(file: string, target: string): void {
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}`);
  try { fs.symlinkSync(target, temporary); fs.renameSync(temporary, file); }
  finally { fs.rmSync(temporary, { force: true }); }
}
export function assertSelection(root: string, spec: HarnessSpec): void {
  const manifest = readJson(within(root, '.harness/workspace.json'), {});
  const onboarding = isObject(manifest) && isObject(manifest.onboarding) ? manifest.onboarding : {};
  if (onboarding.language !== undefined) {
    const local = readJson(within(root, '.harness/workspace.local.json'), {});
    const checkouts = isObject(local) && isObject(local.checkouts) ? local.checkouts : {};
    const self = isObject(manifest) && Array.isArray(manifest.members) ? manifest.members.find(member => {
      if (!isObject(member) || typeof member.id !== 'string') return false;
      const binding = checkouts[member.id];
      return isObject(binding) && typeof binding.path === 'string' && resolvePath(binding.path) === root;
    }) : undefined;
    const language = isObject(self) && typeof self.language === 'string' ? self.language : onboarding.language;
    requireHarness((spec.language ?? 'en') === language, 'Generation language differs from the saved initialization choice');
  }
  if (isObject(onboarding.documentation) && typeof onboarding.documentation.root === 'string') {
    requireHarness(harnessDocumentRoot(spec) === onboarding.documentation.root, 'Generation documentation_root differs from the saved initialization choice');
  }
  if (!isObject(onboarding.harness)) return;
  const selection = onboarding.harness;
  const configuration = harnessConfiguration(spec, renderHarness(spec, { check: '', hook: '', notices: '' }));
  if (selection.layout !== undefined) requireHarness(selection.layout === (spec.layout ?? 'native'), 'Generation layout differs from the saved initialization choices');
  if (Array.isArray(selection.targets)) requireHarness(equal([...selection.targets].sort(), [...spec.targets].sort()), 'Generation targets differ from the saved initialization choices');
  if (isObject(selection.artifacts)) for (const part of HARNESS_PARTS) {
    if (typeof selection.artifacts[part] !== 'boolean') continue;
    const value = spec[part], present = Array.isArray(value) ? value.length > 0 : value !== undefined;
    requireHarness(present === selection.artifacts[part], `Generation does not match the selected ${part} scope`);
    if (present) requireHarness(configuration.parts[part].length > 0, `Selected ${part} produces no native files for the selected targets`);
  }
}
export interface HarnessPlanOptions { adopt?: string[] }
export function makeHarnessPlan(root: string, input: unknown, options: HarnessPlanOptions = {}, lockHeld = false): HarnessPlan {
  validateHarnessSpec(input); root = resolvePath(root);
  requireHarness(stat(root)?.isDirectory(), 'Harness workspace must exist');
  requireHarness(!stat(path.join(root, '.harness'), false)?.isSymbolicLink(), 'Harness state must be a regular directory');
  requireHarness(lockHeld || !stat(path.join(root, '.harness/.generation.lock'), false), 'Harness generation is locked');
  const before = state(root), old = readHarnessReceipt(root), spec = structuredClone(input), adopt = [...new Set(options.adopt ?? [])].sort();
  for (const file of adopt) harnessPath(file);
  assertSelection(root, spec);
  const sources = spec.sources.map(source => {
    const file = sourcePath(root, source); requireHarness(stat(file)?.isFile(), `Source is unavailable: ${source.member ?? 'workspace'}/${source.path}`);
    return { ...source, sha256: fileHash(file) };
  });
  const files: PlannedFile[] = [], conflicts: HarnessPlan['conflicts'] = [], physical = new Map<string, GeneratedArtifact>();
  const aliases = new Map<string, string[]>();
  for (const artifact of renderHarness(spec, runtimeFiles())) {
    const file = within(root, artifact.path);
    if (spec.layout === 'centralized' && artifact.path === 'AGENTS.md') requireHarness(!stat(file, false)?.isSymbolicLink(), 'Centralized AGENTS.md must be a regular file; reconcile the existing entry-point alias first');
    const target = artifact.format === 'symlink' ? artifact.path : path.relative(root, resolvePath(file)).split(path.sep).join('/');
    const previous = physical.get(target);
    requireHarness(!previous || (artifact.kind === 'entrypoint' && previous.kind === 'entrypoint' && previous.content === artifact.content), `Generated artifacts collide at ${target}`);
    physical.set(target, artifact); aliases.set(target, [...(aliases.get(target) ?? []), artifact.path]);
  }
  for (const file of adopt) requireHarness([...aliases].some(([target, paths]) => target === file || paths.includes(file)), `Adoption path is not a planned file: ${file}`);
  for (const source of spec.sources) {
    const relative = path.relative(root, resolvePath(sourcePath(root, source))).split(path.sep).join('/');
    requireHarness(!physical.has(relative), `A generated output cannot also be its own source: ${source.path}`);
  }
  for (const [target, artifact] of physical) {
    if (artifact.format === 'symlink') {
      const destination = within(root, target), { info, link, digest } = outputState(destination), prior = old?.files.find(record => record.path === target);
      requireHarness(!info || info.isFile() || info.isSymbolicLink(), `Output is not a file or symlink: ${target}`);
      const adopted = adopt.includes(target), controlled = !!prior?.owns_file && digest === prior.sha256 && (prior.symlink_target ?? null) === link;
      if (info && link !== artifact.content && !controlled && !adopted) { conflicts.push({ path: target, reason: 'Existing entry point needs explicit reconciliation before replacing it with a symlink' }); continue; }
      files.push({ path: target, logical_paths: [target], kind: artifact.kind, before: digest, before_mode: info ? info.mode & 0o777 : null,
        before_link: link, mode: 0o777, content: artifact.content, symlink_target: artifact.content, sha256: hash(artifact.content), executable: false,
        owns_file: !info || controlled || adopted, action: !info ? 'create' : link === artifact.content ? 'unchanged' : 'update' });
      continue;
    }
    const destination = within(root, target), info = stat(destination), prior = old?.files.find(record => record.path === target);
    requireHarness(!info || info.isFile(), `Output is not a regular file: ${target}`);
    const original = info ? fs.readFileSync(destination, 'utf8') : '', digest = info ? hash(original) : null;
    const adopted = adopt.some(file => file === target || aliases.get(target)!.includes(file));
    const controlled = !!prior?.owns_file && digest === prior.sha256;
    const beforeMode = info ? info.mode & 0o777 : null;
    const mode = artifact.executable ? (beforeMode ?? 0o644) | 0o111 : beforeMode ?? 0o644;
    let content = artifact.content;
    try {
      if (artifact.format === 'entrypoint') {
        const block = managedBlock(original);
        if (block) requireHarness(adopted || (prior?.managed_sha256 && hash(block) === prior.managed_sha256), 'Managed entry-point block changed or has no ownership record');
        content = entrypoint(original, artifact.content);
      } else {
        if (prior && digest !== prior.sha256) requireHarness(adopted, 'Generated file changed or disappeared; reconcile it before explicit adoption');
        if (artifact.format === 'json-merge' || artifact.format === 'toml-merge') {
          const existing: unknown = info ? (artifact.format === 'json-merge' ? JSON.parse(original) : parseToml(original)) : {};
          requireHarness(isObject(existing), 'Existing settings must be an object');
          const patch: unknown = JSON.parse(artifact.content);
          if (artifact.format === 'json-merge' && prior?.settings_patch) checkRetiredSettings(existing, prior.settings_patch, patch);
          if (artifact.format === 'toml-merge' && isObject(patch) && 'sandbox_mode' in patch) requireHarness(!('default_permissions' in existing) && !('permissions' in existing), 'Existing Codex permission profiles need a deliberate migration before sandbox settings can be generated');
          const merged = merge(existing, patch, controlled || adopted);
          content = artifact.format === 'json-merge' ? json(merged) : tomlSettings(original, patch as Record<string, unknown>);
        } else if (info && original !== content) requireHarness(controlled || adopted, 'Existing file is not an unchanged owned artifact; preserve or explicitly adopt its reviewed replacement');
      }
    } catch (error) { conflicts.push({ path: target, reason: (error as Error).message }); continue; }
    const block = artifact.format === 'entrypoint' ? managedBlock(content) : undefined;
    files.push({ path: target, logical_paths: aliases.get(target)!, kind: artifact.kind, before: digest, before_mode: beforeMode, mode, content, sha256: hash(content),
      executable: artifact.executable ?? false, owns_file: !info || controlled || adopted,
      ...(artifact.format === 'json-merge' ? { settings_patch: JSON.parse(artifact.content) as Record<string, unknown> } : {}),
      ...(block ? { managed_sha256: hash(block) } : {}),
      action: !info ? 'create' : original === content && beforeMode === mode ? 'unchanged' : ['entrypoint', 'json-merge', 'toml-merge'].includes(artifact.format) ? 'merge' : 'update' });
  }
  for (const previous of old?.files ?? []) if (!physical.has(previous.path) && stat(within(root, previous.path), false)) conflicts.push({ path: previous.path, reason: 'Artifact is no longer selected; reconcile or remove it explicitly before refreshing. It has not been deleted.' });
  requireHarness(equal(before, state(root)), 'Workspace metadata changed while planning');
  return { schema_version: 1, workspace: root, spec, adopt, before, files, conflicts,
    receipt: { schema_version: 1, profile_sha256: currentProfileHash(root), sources,
      files: files.map(({ before: _before, before_mode: _beforeMode, before_link: _beforeLink, mode: _mode, content: _content, action: _action, ...record }) => record) }, activation: 'not run' };
}
export function applyHarnessPlan(input: unknown, options: { write?: typeof atomicWrite } = {}) {
  requireHarness(isObject(input) && input.schema_version === 1 && typeof input.workspace === 'string' && Array.isArray(input.adopt), 'Invalid harness plan');
  const plan = input as unknown as HarnessPlan, root = resolvePath(plan.workspace);
  const fresh = () => makeHarnessPlan(root, plan.spec, { adopt: plan.adopt }, true);
  requireHarness(equal(fresh(), plan), 'Harness inputs changed since preview; create a new plan');
  requireHarness(plan.conflicts.length === 0, 'Resolve harness plan conflicts before applying');
  const stateDir = path.join(root, '.harness'); fs.mkdirSync(stateDir, { recursive: true });
  const lock = path.join(stateDir, '.generation.lock');
  try { fs.mkdirSync(lock); } catch { throw new Error('Harness generation is locked'); }
  const backups = new Map<string, { bytes: Buffer; mode: number; link: string | null } | null>(), written = new Map<string, { digest: string; link: string | null }>(), directories: string[] = [];
  const write = options.write ?? atomicWrite;
  const verifyAliases = (record: HarnessFileRecord) => {
    const target = path.join(root, record.path);
    if (record.symlink_target) {
      requireHarness(resolvePath(path.dirname(within(root, record.path))) === root && !stat(within(root, record.symlink_target), false)?.isSymbolicLink(), `Entry-point alias target changed: ${record.path}`);
      return;
    }
    requireHarness(resolvePath(within(root, record.path)) === target && record.logical_paths.every(alias => resolvePath(within(root, alias)) === target), `Output alias changed during generation: ${record.path}`);
  };
  try {
    requireHarness(equal(fresh(), plan), 'Harness inputs changed before acquiring the generation lock');
    const outputs = [...plan.files.filter(file => file.action !== 'unchanged').map(file => ({ path: file.path, content: file.content, mode: file.mode, link: file.symlink_target ?? null })),
      { path: HARNESS_RECEIPT, content: json(plan.receipt), mode: 0o644, link: null }];
    for (const output of outputs) {
      const file = within(root, output.path), { info, link, digest } = outputState(file);
      if (output.path === HARNESS_RECEIPT) {
        requireHarness(equal(state(root), plan.before), 'Workspace metadata changed during generation');
        for (const source of plan.receipt.sources) requireHarness(fileHash(sourcePath(root, source)) === source.sha256, `Source changed during generation: ${source.path}`);
        for (const record of plan.files) {
          verifyAliases(record); const current = outputState(within(root, record.path));
          requireHarness(current.digest === record.sha256 && current.link === (record.symlink_target ?? null)
            && (record.symlink_target ? current.info?.isSymbolicLink() : current.info?.isFile() && (current.info.mode & 0o777) === record.mode), `Output changed during generation: ${record.path}`);
        }
      } else {
        const record = plan.files.find(item => item.path === output.path)!; verifyAliases(record);
        requireHarness(digest === record.before && link === (record.before_link ?? null) && (info ? info.mode & 0o777 : null) === record.before_mode, `Output changed during generation: ${output.path}`);
      }
      if (info && digest === hash(output.content) && link === output.link && (link !== null || (info.mode & 0o777) === output.mode)) continue;
      backups.set(file, info ? { bytes: link === null ? fs.readFileSync(file) : Buffer.alloc(0), mode: info.mode & 0o777, link } : null);
      const missing: string[] = []; let parent = path.dirname(file);
      while (!stat(parent)) { missing.push(parent); parent = path.dirname(parent); }
      for (const directory of missing.reverse()) { fs.mkdirSync(directory); directories.push(directory); }
      try { if (output.link !== null) atomicSymlink(file, output.link); else write(file, output.content, output.mode); }
      finally { const current = outputState(file); if (current.digest === hash(output.content) && current.link === output.link) written.set(file, { digest: current.digest, link: current.link }); }
    }
    return { status: 'applied', written: [...written.keys()].map(file => path.relative(root, file)), activation: 'not run' };
  } catch (error) {
    const retained: string[] = [];
    for (const [file, expected] of [...written].reverse()) {
      let unchanged = false;
      try { const current = outputState(file); unchanged = resolvePath(path.dirname(file)) === path.dirname(file) && current.digest === expected.digest && current.link === expected.link; } catch { /* Preserve an unavailable or retargeted path. */ }
      if (!unchanged) { retained.push(path.relative(root, file)); continue; }
      const backup = backups.get(file);
      if (backup?.link !== null && backup?.link !== undefined) atomicSymlink(file, backup.link);
      else if (backup) atomicWrite(file, backup.bytes, backup.mode); else fs.unlinkSync(file);
    }
    for (const directory of directories.reverse()) if (stat(directory, false)?.isDirectory() && resolvePath(directory) === directory && fs.readdirSync(directory).length === 0) fs.rmdirSync(directory);
    if (retained.length) throw new Error(`${(error as Error).message}; concurrent edits retained: ${retained.join(', ')}`);
    throw error;
  } finally { fs.rmdirSync(lock); }
}
