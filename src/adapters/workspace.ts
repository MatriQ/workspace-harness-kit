import fs from 'node:fs';
import path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import type { AdoptionMode, LocalManifest, Member, WorkspaceManifest } from '../core/types.js';
import { componentModel, documentFreshness, fingerprints, MODES, relativePath, requireWorkspace, schema, sourceSnapshot, validateId, validateLanguage, validateManifest, WorkspaceError } from '../core/registry.js';
import { equal, isObject, json } from '../core/json.js';
import { planOnboarding, validateOnboarding } from '../core/onboarding.js';
import type { OnboardingProfile } from '../core/onboarding.js';
import { atomicWrite, expandUser, fileHash, hash, readJson, resolvePath, stat, within } from './files.js';
import { assertPrivate, localContextEntry, readLocalContext, renderLocalContext, machineFingerprint, validateLocalContext, LEGACY_LOCAL_CONTEXT } from './local-context.js';
import { isLocalResource } from '../core/local-context.js';
import { inspectExistingDocuments } from './document-inventory.js';
import type { DocumentInventory } from './document-inventory.js';

export { WorkspaceError, componentModel, validateManifest } from '../core/registry.js';
const MANIFEST = 'workspace.json', LOCAL = 'local-context';
const SKIP_DIRS = new Set(['node_modules', 'vendor', 'target', 'dist', 'build', 'coverage', '__pycache__']);
const PROJECT_FILES: Record<string, string> = { 'package.json': 'JavaScript', 'tsconfig.json': 'TypeScript', 'pyproject.toml': 'Python', 'setup.py': 'Python', 'setup.cfg': 'Python', 'requirements.txt': 'Python', Pipfile: 'Python', 'go.mod': 'Go', 'Cargo.toml': 'Rust', 'pom.xml': 'Java', 'build.gradle': 'JVM', 'build.gradle.kts': 'Kotlin', Gemfile: 'Ruby', 'composer.json': 'PHP' };
const LOCKFILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'uv.lock', 'poetry.lock', 'Pipfile.lock', 'go.sum', 'Cargo.lock', '.node-version', '.nvmrc', '.python-version', '.tool-versions']);
const FRAMEWORKS: Record<string, string> = { react: 'React', next: 'Next.js', vue: 'Vue', nuxt: 'Nuxt', express: 'Express', '@nestjs/core': 'NestJS', fastapi: 'FastAPI', django: 'Django', flask: 'Flask' };
import { checkout, git } from './git.js';
import type { Checkout } from './git.js';
export { checkout, git, normalizedRemote } from './git.js';
export type { Checkout } from './git.js';
export interface Source { path: string; category: string; sha256?: string; unavailable?: boolean; language?: string | null; script_names?: string[]; typescript?: boolean; frameworks?: string[]; parse_error?: boolean }
export type Selection = [id: string, mode: AdoptionMode, directory: string];
export type MemberOption = [id: string, value: string];
export interface PlanRequest { members: Selection[]; language: string | null; member_languages: MemberOption[]; reviews?: MemberOption[]; source_files?: MemberOption[]; profile?: OnboardingProfile; local_context?: string; local_patch?: unknown }
export interface WorkspacePlan {
  schema_version: 1; workspace: string; before: Record<string, string | null>; request: PlanRequest;
  selections: Record<string, Checkout>; effective_languages: Record<string, string>; analysis: Record<string, Source[]>;
  document_consolidation: Record<string, DocumentInventory>;
  shared: WorkspaceManifest; local: LocalManifest; local_context: { path: string; migration: boolean; backup: string | null; markdown_backup: string | null };
}
export interface DiscoverOptions { repo?: string[]; directory?: string[]; depth?: number; includeNested?: boolean; cwd?: string }
export function discover(options: DiscoverOptions = {}) {
  const depth = options.depth ?? 3;
  requireWorkspace(Number.isSafeInteger(depth) && depth >= 0, '--depth must be zero or greater.');
  const paths = new Map<string, Checkout>(), issues: string[] = [];
  function add(candidate: string) {
    try { const record = checkout(candidate); paths.set(record.path, record); }
    catch (error) { if (!(error instanceof WorkspaceError)) throw error; issues.push(error.message); }
  }
  function visit(directory: string, remaining: number): void {
    if (stat(path.join(directory, '.git'))) { add(directory); if (!options.includeNested) return; }
    if (!remaining) return;
    let children: fs.Dirent[];
    try { children = fs.readdirSync(directory, { withFileTypes: true }); }
    catch (error) { issues.push((error as Error).message); return; }
    for (const child of children.sort((a, b) => a.name < b.name ? -1 : 1)) {
      if (!child.name.startsWith('.') && !SKIP_DIRS.has(child.name) && child.isDirectory() && !child.isSymbolicLink()) visit(path.join(directory, child.name), remaining - 1);
    }
  }
  let explicit = options.repo ?? [], directories = options.directory ?? [];
  if (!explicit.length && !directories.length) {
    const current = options.cwd ?? process.cwd();
    if (git(current, 'rev-parse', '--show-toplevel')) explicit = [current]; else directories = [current];
  }
  for (const directory of explicit) add(resolvePath(directory));
  for (const directory of directories) {
    const root = resolvePath(directory);
    if (stat(root)?.isDirectory()) visit(root, depth); else issues.push(`Directory is unavailable: ${root}`);
  }
  const groups = new Map<string, Checkout[]>();
  for (const root of [...paths.keys()].sort()) {
    const item = paths.get(root)!, key = JSON.stringify(item.remote ? ['remote', item.remote] : ['git', item.git_common_dir]);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return { repositories: [...groups.values()].map(items => ({ remote: items[0].remote, checkouts: items })), issues };
}
function sourceCategory(file: string): string | null {
  const name = path.posix.basename(file);
  if (Object.hasOwn(PROJECT_FILES, name) || LOCKFILES.has(name) || name.endsWith('.csproj') || (name.startsWith('requirements') && name.endsWith('.txt'))) return 'project';
  if (['Makefile', 'justfile', 'Taskfile.yml', 'Taskfile.yaml', 'tox.ini', 'pytest.ini', 'AGENTS.md', 'CLAUDE.md', 'README.md', 'CONTRIBUTING.md'].includes(name)) return 'entrypoint';
  if (['.env.example', '.env.sample', '.env.template', 'example.env'].includes(name)) return 'configuration';
  if (['Dockerfile', 'compose.', 'docker-compose.'].some(prefix => name.startsWith(prefix)) || file.startsWith('.github/workflows/') || ['.gitlab-ci.yml', 'Jenkinsfile', 'azure-pipelines.yml'].includes(name)) return 'delivery';
  return null;
}
function inspectManifest(file: string, name: string, result: Source): void {
  if (!['package.json', 'pyproject.toml'].includes(name) && !name.startsWith('requirements')) return;
  try {
    const data = fs.readFileSync(file, 'utf8');
    const dependencies = new Set<string>();
    if (name === 'package.json') {
      const pkg: unknown = JSON.parse(data);
      if (!isObject(pkg)) throw new Error('Expected package object');
      const scripts = pkg.scripts ?? {};
      if (isObject(scripts)) result.script_names = Object.keys(scripts).sort();
      for (const key of ['dependencies', 'devDependencies', 'peerDependencies']) if (isObject(pkg[key])) for (const dep of Object.keys(pkg[key])) dependencies.add(dep);
      if (dependencies.has('typescript')) result.typescript = true;
    } else if (name === 'pyproject.toml') {
      const document = parseToml(data, { integersAsBigInt: 'asNeeded' });
      const project = document.project ?? {}, tool = document.tool ?? {};
      if (!isObject(project) || !isObject(tool)) throw new Error('Invalid project tables');
      const poetry = tool.poetry ?? {};
      if (!isObject(poetry)) throw new Error('Invalid poetry table');
      const poetryDeps = poetry.dependencies ?? {}, declarations = project.dependencies ?? [];
      if (!isObject(poetryDeps) || !Array.isArray(declarations)) throw new Error('Invalid dependency declarations');
      for (const dep of Object.keys(poetryDeps)) dependencies.add(dep);
      for (const item of declarations) if (typeof item === 'string') { const match = /^[A-Za-z0-9_.-]+/.exec(item); if (match) dependencies.add(match[0]); }
    } else for (const match of data.matchAll(/^[A-Za-z0-9][A-Za-z0-9_.-]*/gm)) dependencies.add(match[0]);
    result.frameworks = [...new Set([...dependencies].map(dep => dep.toLowerCase()).filter(dep => Object.hasOwn(FRAMEWORKS, dep)).map(dep => FRAMEWORKS[dep]))].sort();
  } catch { result.parse_error = true; }
}
export function analyze(root: string, extraSources: string[] = []): Source[] {
  const listing = git(root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z');
  requireWorkspace(listing !== null, `Could not list repository files: ${root}`);
  const inventory: Source[] = [];
  for (const entry of [...new Set([...listing.split('\0'), ...extraSources])].filter(Boolean).sort()) {
    if (isLocalResource(entry)) { requireWorkspace(!extraSources.includes(entry), `Local context cannot be a shared source: ${entry}`); continue; }
    if (entry.split('/').some(part => SKIP_DIRS.has(part) || ['.venv', '.git', '.worktrees'].includes(part))) {
      requireWorkspace(!extraSources.includes(entry), `Explicit source is in an excluded directory: ${entry}`); continue;
    }
    let file: string;
    try { file = within(root, entry); } catch (error) { if (extraSources.includes(entry) || !(error instanceof WorkspaceError)) throw error; continue; }
    const category = sourceCategory(entry) ?? (extraSources.includes(entry) ? 'explicit' : null);
    if (!category || (stat(file, false)?.isSymbolicLink() && !extraSources.includes(entry))) continue;
    const result: Source = { path: entry, category };
    if (!stat(file)?.isFile() || stat(file, false)?.isSymbolicLink()) result.unavailable = true;
    else {
      result.sha256 = fileHash(file);
      const name = path.basename(file);
      result.language = Object.hasOwn(PROJECT_FILES, name) ? PROJECT_FILES[name] : null;
      if (name.endsWith('.csproj')) result.language = 'C#'; else if (name.startsWith('requirements')) result.language = 'Python';
      inspectManifest(file, name, result);
    }
    inventory.push(result);
  }
  return inventory;
}
function manifestPaths(root: string, entry = localContextEntry(root)): Record<string, string> {
  const state = path.join(root, '.harness'), info = stat(state, false);
  requireWorkspace(!info || (info.isDirectory() && !info.isSymbolicLink()), `Expected a regular state directory: ${state}`);
  const paths: Record<string, string> = { [MANIFEST]: within(root, '.harness/workspace.json'), [LOCAL]: within(root, entry),
    '.gitignore': within(root, '.harness/.gitignore'), 'root-ignore': within(root, '.gitignore'), legacy: within(root, LEGACY_LOCAL_CONTEXT) };
  for (const file of Object.values(paths)) { const info = stat(file, false); requireWorkspace(!info || (info.isFile() && !info.isSymbolicLink()), `Expected a regular state file: ${file}`); }
  return paths;
}
function fileState(paths: Record<string, string>): Record<string, string | null> { return Object.fromEntries(Object.entries(paths).map(([name, file]) => [name, stat(file) ? fileHash(file) : null])); }
function assertLocalUntracked(root: string, entry = localContextEntry(root)): void {
  assertPrivate(root, entry, false); assertPrivate(root, LEGACY_LOCAL_CONTEXT, false);
}
export interface PlanOptions { reviews?: MemberOption[]; sourceFiles?: MemberOption[]; profile?: OnboardingProfile; local_context?: string; local_patch?: unknown }
export function makePlan(root: string, selections: Selection[] = [], language: string | null = null, overrides: MemberOption[] = [], options: PlanOptions = {}): WorkspacePlan {
  return planInternal(root, selections, language, overrides, options, false);
}
function planInternal(root: string, selections: Selection[], language: string | null, overrides: MemberOption[], options: PlanOptions, lockHeld: boolean): WorkspacePlan {
  root = resolvePath(root);
  requireWorkspace(stat(root)?.isDirectory(), `Workspace directory is unavailable: ${root}`);
  const previousEntry = localContextEntry(root);
  if (options.local_context !== undefined && options.local_context !== previousEntry) {
    const previous = readLocalContext(root, { planning: true });
    requireWorkspace(previous.format !== 'markdown', `Local context already exists at ${previousEntry}; preserve/reconcile that entry before selecting another authority`);
  }
  const context = readLocalContext(root, { file: options.local_context, planning: true });
  const paths = manifestPaths(root, context.path);
  if (context.legacy) {
    const receiptFile = within(root, '.harness/generated.json');
    if (stat(receiptFile)) {
      const receipt = readJson(receiptFile);
      const runtime = isObject(receipt) && Array.isArray(receipt.files) ? receipt.files.find(file => isObject(file) && file.path === '.harness/runtime/local-context.mjs') : undefined;
      requireWorkspace(isObject(runtime) && typeof runtime.sha256 === 'string' && stat(within(root, runtime.path as string))?.isFile()
        && fileHash(within(root, runtime.path as string)) === runtime.sha256, 'Refresh generated local-context consumers with the saved harness spec before retiring legacy JSON; reconcile custom project locators too');
      const saved = readJson(within(root, '.harness/harness.json'), {});
      const resources = isObject(saved) ? [saved.resources, ...(Array.isArray(saved.skills) ? saved.skills.filter(isObject).map(skill => skill.resources) : [])].flatMap(value => Array.isArray(value) ? value : []) : [];
      for (const resource of resources) if (isObject(resource) && typeof resource.path === 'string' && /\.(?:[cm]?js|ts|py|sh)$/.test(resource.path)
        && typeof resource.body === 'string' && resource.body.includes('workspace.local.json')) requireWorkspace(false, `Reconcile declared legacy locator resource before migration: ${resource.path}; use the shared local-context runtime`);

    }
  }
  requireWorkspace(lockHeld || !stat(path.join(root, '.harness/.workspace.lock'), false), 'Workspace apply is locked. Recover an interrupted apply and create a new plan.');
  assertLocalUntracked(root, context.path);
  const before = fileState(paths);
  const shared = readJson(paths[MANIFEST], { schema_version: 1, language: 'en', members: [] });
  let local = structuredClone(context.data);
  if (!context.machine_matches) {
    const snapshot = { machine: local.machine, tools: local.tools, access: local.access, execution: local.execution, onboarding_status: local.onboarding_status };
    const history = isObject(local.state?.machine_history) ? local.state.machine_history : {};
    local.state = { ...local.state, machine_history: { ...history, [hash(json(snapshot))]: snapshot }, previous_machine_state: snapshot };
    local.tools = {}; local.access = {}; local.execution = { status: 'pending', reason: 'Machine changed; verify readiness again' }; local.onboarding_status = {};
  }
  if (options.local_patch !== undefined) {
    requireWorkspace(isObject(options.local_patch) && !('schema_version' in options.local_patch) && !('machine' in options.local_patch), 'Local patch must contain state fields, not schema_version or machine');
    const mergePatch = (current: unknown, patch: unknown): unknown => isObject(current) && isObject(patch) ? Object.fromEntries([...new Set([...Object.keys(current), ...Object.keys(patch)])].map(key => [key, Object.hasOwn(patch, key) ? mergePatch(current[key], patch[key]) : current[key]])) : structuredClone(patch);
    const patched = mergePatch(local, options.local_patch);
    validateLocalContext(patched); local = patched;
  }
  local.machine = machineFingerprint();
  const members = validateManifest(shared), bindings = local.checkouts;
  const manifest = shared as WorkspaceManifest;
  manifest.local_context = context.path;
  if (options.profile !== undefined) { validateOnboarding(options.profile); manifest.onboarding = structuredClone(options.profile); }
  if (options.profile?.language && language !== null) requireWorkspace(options.profile.language === language, '--language differs from the supplied profile language; choose one language before previewing');
  if (language !== null) {
    validateLanguage(language); manifest.language = language;
    if (manifest.onboarding && (language === 'en' || language === 'zh-CN')) manifest.onboarding.language = language;
  } else if (options.profile?.language) manifest.language = options.profile.language;
  requireWorkspace(Array.isArray(selections) && Array.isArray(overrides), 'Invalid plan selections.');
  const selected = new Map<string, [AdoptionMode, Checkout]>();
  for (const selection of selections) {
    requireWorkspace(Array.isArray(selection) && selection.length === 3, 'Invalid member selection.');
    const [id, mode, directory] = selection;
    validateId(id);
    requireWorkspace(!selected.has(id) && MODES.includes(mode), `Repeated member ID or invalid member mode: ${id} ${mode}`);
    selected.set(id, [mode, checkout(resolvePath(directory))]);
  }
  const overrideById = new Map<string, string>();
  for (const [id, locale] of overrides) { requireWorkspace(selected.has(id) && !overrideById.has(id), `Language override requires a uniquely selected member: ${id}`); validateLanguage(locale); overrideById.set(id, locale); }
  const reviews = options.reviews ?? [], sourceFiles = options.sourceFiles ?? [];
  for (const [id, file] of [...reviews, ...sourceFiles]) {
    requireWorkspace(selected.has(id) && selected.get(id)![0] !== 'register', `Source and review options need a selected analyze/init member: ${id}`); relativePath(file); requireWorkspace(!isLocalResource(file), 'Local context cannot enter shared source or document review baselines');
  }
  const analysis = new Map<string, Source[]>(), languages = new Map<string, string>();
  const documentInventories = new Map<string, DocumentInventory>();
  for (const [id, [mode, record]] of selected) {
    const old = Object.hasOwn(members, id) ? members[id] : undefined;
    requireWorkspace(!old?.remote || old.remote === record.remote, `Checkout identity changed for ${id}; review the shared member before rebinding it.`);
    for (const [otherId, binding] of Object.entries(bindings)) requireWorkspace(otherId === id || record.git_common_dir !== binding.git_common_dir, `${id} and ${otherId} refer to the same Git repository.`);
    const member: Member = { ...old, id, mode };
    if (record.path === root) manifest.workspace_member = id;
    if (record.remote) member.remote = record.remote;
    if (overrideById.has(id)) member.language = overrideById.get(id)!;
    languages.set(id, member.language ?? manifest.language);
    const extra = [...new Set([...(member.source_files ?? []), ...sourceFiles.filter(([key]) => key === id).map(([, file]) => file)])].sort();
    if (extra.length) member.source_files = extra;
    const inventory = mode === 'register' ? [] : analyze(record.path, extra);
    if (mode !== 'register') {
      const listing = git(record.path, 'ls-files', '--cached', '--others', '--exclude-standard', '-z');
      requireWorkspace(listing !== null, `Could not inventory existing documents: ${record.path}`);
      const writable = mode === 'init' || (record.path === root && manifest.onboarding?.documentation?.placement !== 'members');
      documentInventories.set(id, inspectExistingDocuments(record.path, id, listing, manifest.onboarding, writable));
    }
    if (mode !== 'register') member.sources = sourceSnapshot(inventory);
    const reviewed = new Map((member.document_reviews ?? []).map(item => [item.path, item]));
    for (const file of [...new Set(reviews.filter(([key]) => key === id).map(([, file]) => file))].sort()) {
      const destination = within(record.path, file);
      requireWorkspace(stat(destination)?.isFile() && !stat(destination, false)?.isSymbolicLink(), `Review needs an existing regular document: ${id}/${file}`);
      requireWorkspace(!inventory.some(item => item.unavailable || item.parse_error), `Resolve unavailable or malformed sources before reviewing ${id}/${file}`);
      reviewed.set(file, { path: file, sha256: fileHash(destination), sources: member.sources!.filter(item => item.path !== file),
        ...(manifest.onboarding ? { onboarding_sha256: hash(json(manifest.onboarding)) } : {}) });
      member.documents = [...new Set([...(member.documents ?? []), file])].sort();
    }
    if (reviewed.size) member.document_reviews = [...reviewed.keys()].sort().map(key => reviewed.get(key)!);
    members[id] = member;
    bindings[id] = { path: record.path, git_common_dir: record.git_common_dir };
    analysis.set(id, inventory);
  }
  manifest.members = Object.keys(members).sort().map(key => members[key]);
  for (const choice of manifest.onboarding?.documentation?.existing_documents ?? []) requireWorkspace(Object.hasOwn(members, choice.member), `Existing document choice references an unknown member: ${choice.member}`);
  validateLocalContext(local);
  for (const [id, binding] of Object.entries(bindings)) {
    const actual = checkout(resolvePath(path.resolve(root, expandUser(binding.path))));
    requireWorkspace(Object.hasOwn(members, id) && actual.git_common_dir === resolvePath(path.resolve(root, expandUser(binding.git_common_dir))) && actual.remote === (members[id].remote ?? null), `Local checkout identity differs for ${id}; inspect and rebind it`);
    bindings[id] = { path: actual.path, git_common_dir: actual.git_common_dir };
  }
  validateManifest(manifest);
  renderLocalContext(context.markdown, local); // Reject an oversized update before any write.
  requireWorkspace(equal(before, fileState(paths)), 'Workspace files changed while planning. Preview again.');
  const request: PlanRequest = { language, member_languages: overrides, members: [...selected].map(([id, [mode, record]]) => [id, mode, record.path]) };
  if (reviews.length) request.reviews = reviews;
  if (sourceFiles.length) request.source_files = sourceFiles;
  if (options.profile !== undefined) request.profile = structuredClone(options.profile);
  if (options.local_context !== undefined) request.local_context = options.local_context;
  if (options.local_patch !== undefined) request.local_patch = structuredClone(options.local_patch);
  return { schema_version: 1, workspace: root, before, request, selections: Object.fromEntries([...selected].map(([id, [, record]]) => [id, record])),
    effective_languages: Object.fromEntries(languages), analysis: Object.fromEntries(analysis), document_consolidation: Object.fromEntries(documentInventories), shared: manifest, local, local_context: { path: context.path, migration: !!context.legacy, backup: context.legacy ? `.harness/local-backups/workspace.local.${before.legacy}.json.bak` : null, markdown_backup: context.legacy && before[LOCAL] ? `.harness/local-backups/${path.basename(context.path)}.${before[LOCAL]}.bak` : null } };
}
export interface ApplyOptions { write?: typeof atomicWrite }
export function applyPlan(input: unknown, options: ApplyOptions = {}) {
  schema(input);
  requireWorkspace(typeof input.workspace === 'string' && isObject(input.request), 'Invalid plan. Create a new preview with the plan command.');
  const old = input as unknown as WorkspacePlan, request = old.request, root = old.workspace;
  const planOptions = { reviews: request.reviews, sourceFiles: request.source_files, profile: request.profile, local_context: request.local_context, local_patch: request.local_patch };
  let fresh = makePlan(root, request.members, request.language, request.member_languages, planOptions);
  requireWorkspace(equal(fresh, old), 'The workspace, selected checkout, or analysis changed since preview. Create a new plan.');
  let paths = manifestPaths(root, fresh.local_context.path);
  const state = path.dirname(paths[MANIFEST]);
  const directories: string[] = [];
  fs.mkdirSync(state, { recursive: true }); paths = manifestPaths(root, fresh.local_context.path);
  const lock = path.join(state, '.workspace.lock');
  try { fs.mkdirSync(lock); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; throw new WorkspaceError(`Apply is locked: ${lock}. Recover the interrupted apply and create a new plan.`); }
  const backups = new Map<string, { content: Buffer; mode: number } | null>(), written = new Map<string, string>(), changes: string[] = [];
  const write = options.write ?? atomicWrite;
  try {
    fresh = planInternal(root, request.members, request.language, request.member_languages, planOptions, true);
    requireWorkspace(equal(fresh, old), 'Workspace changed before the apply lock was acquired. Create a new plan.');
    for (const [name, file] of Object.entries(paths)) { const info = stat(file); backups.set(name, info ? { content: fs.readFileSync(file), mode: info.mode & 0o777 } : null); }
    const addRules = (original: string, rules: string[]) => original + (original && !original.endsWith('\n') ? '\n' : '') + rules.filter(rule => !original.split(/\r?\n/).includes(rule)).map(rule => rule + '\n').join('');
    const ignores = addRules(backups.get('.gitignore')?.content.toString('utf8') ?? '', ['/.workspace.lock/', '/workspace.local.json', '/local-backups/', '/local-evidence/', '*.local.json', '*.local.md']);
    const rootIgnores = addRules(backups.get('root-ignore')?.content.toString('utf8') ?? '', ['*.local.md', '*.local.json']);
    const context = readLocalContext(root, { file: fresh.local_context.path, planning: true });
    const markdown = renderLocalContext(context.markdown, fresh.local);
    const payloads: Array<[string, string, number]> = [['.gitignore', ignores, 0o644], ['root-ignore', rootIgnores, 0o644], [LOCAL, markdown, 0o600], [MANIFEST, json(fresh.shared), 0o644]];
    for (const [name, relative, source] of [['backup', fresh.local_context.backup, 'legacy'], ['markdown-backup', fresh.local_context.markdown_backup, LOCAL]] as const) {
      if (!relative) continue;
      const backup = within(root, relative), original = backups.get(source)!.content;
      requireWorkspace(!stat(backup, false)?.isSymbolicLink(), 'Migration recovery copy must be a regular file');
      paths[name] = backup;
      const previous = stat(backup);
      requireWorkspace(!previous || fs.readFileSync(backup).equals(original), 'Migration backup differs; preserve it and investigate');
      backups.set(name, previous ? { content: fs.readFileSync(backup), mode: previous.mode & 0o777 } : null);
      payloads.splice(2, 0, [name, original.toString('utf8'), 0o600]);
    }
    for (const [name, content, mode] of payloads) {
      const file = paths[name];
      manifestPaths(root, fresh.local_context.path);
      within(root, path.relative(root, file));
      requireWorkspace(!stat(file, false)?.isSymbolicLink(), `Workspace output became a symlink: ${file}`);
      if (name === LOCAL) assertPrivate(root, fresh.local_context.path);
      if (stat(file) && fs.readFileSync(file).equals(Buffer.from(content))) continue;
      if (name !== 'backup' && name !== 'markdown-backup') requireWorkspace((stat(file) ? fileHash(file) : null) === fresh.before[name], `Workspace file changed during apply: ${file}`);
      if (name === LOCAL) assertPrivate(root, fresh.local_context.path);
      if (name === 'backup' || name === 'markdown-backup') assertPrivate(root, path.relative(root, file));
      const missing: string[] = []; let parent = path.dirname(file);
      while (!stat(parent)) { missing.push(parent); parent = path.dirname(parent); }
      for (const directory of missing.reverse()) { fs.mkdirSync(directory); directories.push(directory); }
      try { write(file, content, mode); } finally { if (stat(file, false)?.isFile() && fileHash(file) === hash(content)) written.set(name, hash(content)); }
      changes.push(path.relative(root, file));
    }
    if (fresh.local_context.migration) {
      within(root, LEGACY_LOCAL_CONTEXT);
      requireWorkspace(fileHash(paths.legacy) === fresh.before.legacy, 'Legacy local context changed during migration');
      fs.unlinkSync(paths.legacy); written.set('legacy', 'deleted'); changes.push(LEGACY_LOCAL_CONTEXT);
    }
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (const [name, digest] of [...written].reverse()) {
      const file = paths[name];
      try {
        within(root, path.relative(root, file));
        if ((digest === 'deleted' ? !!stat(file) : !stat(file) || fileHash(file) !== digest) || stat(file, false)?.isSymbolicLink()) { rollbackErrors.push(`${file}: changed by another writer`); continue; }
        const backup = backups.get(name);
        if (!backup) fs.unlinkSync(file); else write(file, backup.content, backup.mode);
      } catch { rollbackErrors.push(`${file}: restore failed`); }
    }
    for (const directory of directories.reverse()) if (stat(directory, false)?.isDirectory() && resolvePath(directory) === directory && !fs.readdirSync(directory).length) fs.rmdirSync(directory);
    if (rollbackErrors.length) throw new WorkspaceError('Apply failed and some files need manual recovery: ' + rollbackErrors.join('; '));
    throw error;
  } finally { fs.rmdirSync(lock); }
  return { workspace: root, members: Object.keys(fresh.selections).sort(), written: changes };
}
export function checkWorkspace(root: string, local = false) {
  root = resolvePath(root);
  const paths = manifestPaths(root);
  requireWorkspace(!stat(path.join(root, '.harness/.workspace.lock'), false), 'Workspace apply is locked. Check again after it completes or recover the interrupted apply.');
  const shared = readJson(paths[MANIFEST]);
  const members = validateManifest(shared), manifest = shared as WorkspaceManifest;
  const errors: string[] = [], warnings: string[] = [];
  const documentStatus: Array<{ member: string; path: string; status: string; reason: string | null }> = [];
  const model = componentModel(manifest, members);
  for (const file of manifest.documents ?? []) if (!stat(within(root, file))?.isFile()) errors.push(`Missing workspace document: ${file}`);
  assertLocalUntracked(root);
  if (local) {
    const context = readLocalContext(root);
    if (!context.machine_matches) warnings.push('Local context belongs to another machine; rebind and verify readiness');
    const bindings = context.machine_matches ? context.data.checkouts : {};
    for (const id of Object.keys(bindings).sort()) if (!Object.hasOwn(members, id)) errors.push(`Local checkout has no shared member: ${id}`);
    for (const [id, member] of Object.entries(members)) {
      if (!Object.hasOwn(bindings, id)) { warnings.push(`Missing local checkout binding: ${id}; complete ${localContextEntry(root)}`); continue; }
      const binding = bindings[id], directory = binding.path;
      try {
        const record = checkout(directory);
        requireWorkspace(record.path === directory && record.git_common_dir === binding.git_common_dir && record.remote === (member.remote ?? null), 'The current checkout identity differs from the recorded identity.');
        for (const file of member.documents ?? []) if (!stat(within(directory, file))?.isFile()) errors.push(`${id}: Missing member document ${file}`);
        if (member.mode !== 'register' || member.sources?.length || member.document_reviews?.length) {
          const inventory = analyze(directory, member.source_files ?? []), current = fingerprints(sourceSnapshot(inventory)), previous = fingerprints(member.sources ?? []);
          for (const file of [...new Set([...Object.keys(previous), ...Object.keys(current)])].sort()) {
            if (!Object.hasOwn(current, file)) warnings.push(`${id}: Source unavailable: ${file}`);
            else if (!Object.hasOwn(previous, file)) warnings.push(`${id}: Source added: ${file}`);
            else if (current[file] !== previous[file]) warnings.push(`${id}: Source changed: ${file}`);
          }
          const invalid = inventory.filter(item => item.parse_error || item.unavailable).map(item => item.path);
          for (const file of invalid) {
            if (!Object.hasOwn(previous, file)) warnings.push(`${id}: Source unavailable or malformed: ${file}`);
            else if (Object.hasOwn(current, file)) warnings.push(`${id}: Source malformed: ${file}`);
          }
          const reviews = new Map((member.document_reviews ?? []).map(item => [item.path, item]));
          for (const name of member.documents ?? []) {
            const file = within(directory, name), digest = stat(file)?.isFile() && !stat(file, false)?.isSymbolicLink() ? fileHash(file) : null;
            const reason = documentFreshness(reviews.get(name), digest, current, invalid.length > 0,
              manifest.onboarding ? hash(json(manifest.onboarding)) : undefined);
            documentStatus.push({ member: id, path: name, status: reason ? 'pending' : 'current', reason });
            if (reason) warnings.push(`${id}: Document needs review (${reason}): ${name}`);
          }
        }
        for (const component of Object.values(model.components)) if (component.member === id) {
          const file = component.path === '.' ? directory : within(directory, component.path);
          if (!stat(file)?.isDirectory()) errors.push(`${component.id}: Missing component directory ${component.path}`);
        }
      } catch (error) { errors.push(`${id}: ${(error as Error).message}`); }
    }
  }
  return { workspace: root, members: Object.keys(members).sort(), errors, warnings, document_reviews: documentStatus,
    source_checks: local ? 'performed' : 'not run', ...model,
    ...(manifest.onboarding ? { onboarding: planOnboarding(manifest.onboarding) } : {}) };
}
