import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse as parseToml } from 'smol-toml';
import type { AdoptionMode, Binding, LocalManifest, Member, WorkspaceManifest } from '../core/types.js';
import { componentModel, documentFreshness, fingerprints, MODES, relativePath, requireWorkspace, schema, sourceSnapshot, validateId, validateLanguage, validateManifest, WorkspaceError } from '../core/registry.js';
import { equal, isObject, json } from '../core/json.js';
import { planOnboarding, validateOnboarding } from '../core/onboarding.js';
import type { OnboardingProfile } from '../core/onboarding.js';
import { atomicWrite, fileHash, hash, readJson, resolvePath, stat, within } from './files.js';
import { inspectExistingDocuments } from './document-inventory.js';
import type { DocumentInventory } from './document-inventory.js';

export { WorkspaceError, componentModel, validateManifest } from '../core/registry.js';
const MANIFEST = 'workspace.json', LOCAL = 'workspace.local.json';
const SKIP_DIRS = new Set(['node_modules', 'vendor', 'target', 'dist', 'build', 'coverage', '__pycache__']);
const PROJECT_FILES: Record<string, string> = { 'package.json': 'JavaScript', 'tsconfig.json': 'TypeScript', 'pyproject.toml': 'Python', 'setup.py': 'Python', 'setup.cfg': 'Python', 'requirements.txt': 'Python', Pipfile: 'Python', 'go.mod': 'Go', 'Cargo.toml': 'Rust', 'pom.xml': 'Java', 'build.gradle': 'JVM', 'build.gradle.kts': 'Kotlin', Gemfile: 'Ruby', 'composer.json': 'PHP' };
const LOCKFILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'uv.lock', 'poetry.lock', 'Pipfile.lock', 'go.sum', 'Cargo.lock', '.node-version', '.nvmrc', '.python-version', '.tool-versions']);
const FRAMEWORKS: Record<string, string> = { react: 'React', next: 'Next.js', vue: 'Vue', nuxt: 'Nuxt', express: 'Express', '@nestjs/core': 'NestJS', fastapi: 'FastAPI', django: 'Django', flask: 'Flask' };
export interface Checkout extends Binding { kind: 'checkout' | 'submodule' | 'worktree'; branch: string | null; head: string | null; remote: string | null; harness: boolean }
export interface Source { path: string; category: string; sha256?: string; unavailable?: boolean; language?: string | null; script_names?: string[]; typescript?: boolean; frameworks?: string[]; parse_error?: boolean }
export type Selection = [id: string, mode: AdoptionMode, directory: string];
export type MemberOption = [id: string, value: string];
export interface PlanRequest { members: Selection[]; language: string | null; member_languages: MemberOption[]; reviews?: MemberOption[]; source_files?: MemberOption[]; profile?: OnboardingProfile }
export interface WorkspacePlan {
  schema_version: 1; workspace: string; before: Record<string, string | null>; request: PlanRequest;
  selections: Record<string, Checkout>; effective_languages: Record<string, string>; analysis: Record<string, Source[]>;
  document_consolidation: Record<string, DocumentInventory>;
  shared: WorkspaceManifest; local: LocalManifest;
}
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
function manifestPaths(root: string): Record<string, string> {
  const state = path.join(root, '.harness'), info = stat(state, false);
  requireWorkspace(!info || (info.isDirectory() && !info.isSymbolicLink()), `Expected a regular state directory: ${state}`);
  const paths = Object.fromEntries([MANIFEST, LOCAL, '.gitignore'].map(name => [name, path.join(state, name)]));
  for (const file of Object.values(paths)) { const info = stat(file, false); requireWorkspace(!info || (info.isFile() && !info.isSymbolicLink()), `Expected a regular state file: ${file}`); }
  return paths;
}
function validateBindings(value: unknown): Record<string, Binding> {
  schema(value); requireWorkspace(isObject(value.checkouts), 'Local checkouts must be an object keyed by member ID.');
  for (const [id, binding] of Object.entries(value.checkouts)) {
    validateId(id);
    for (const field of ['path', 'git_common_dir']) requireWorkspace(isObject(binding) && typeof binding[field] === 'string' && path.isAbsolute(binding[field]), `Expected an absolute local ${field} for ${id}.`);
  }
  return value.checkouts as Record<string, Binding>;
}
function fileState(paths: Record<string, string>): Record<string, string | null> { return Object.fromEntries(Object.entries(paths).map(([name, file]) => [name, stat(file) ? fileHash(file) : null])); }
function assertLocalUntracked(root: string): void {
  requireWorkspace(git(root, 'ls-files', '--error-unmatch', '--', `.harness/${LOCAL}`) === null, `Untrack .harness/${LOCAL} before updating local checkout bindings.`);
}
export interface PlanOptions { reviews?: MemberOption[]; sourceFiles?: MemberOption[]; profile?: OnboardingProfile }
export function makePlan(root: string, selections: Selection[] = [], language: string | null = null, overrides: MemberOption[] = [], options: PlanOptions = {}): WorkspacePlan {
  return planInternal(root, selections, language, overrides, options, false);
}
function planInternal(root: string, selections: Selection[], language: string | null, overrides: MemberOption[], options: PlanOptions, lockHeld: boolean): WorkspacePlan {
  root = resolvePath(root);
  requireWorkspace(stat(root)?.isDirectory(), `Workspace directory is unavailable: ${root}`);
  const paths = manifestPaths(root);
  requireWorkspace(lockHeld || !stat(path.join(root, '.harness/.workspace.lock'), false), 'Workspace apply is locked. Recover an interrupted apply and create a new plan.');
  assertLocalUntracked(root);
  const before = fileState(paths);
  const shared = readJson(paths[MANIFEST], { schema_version: 1, language: 'en', members: [] });
  const local = readJson(paths[LOCAL], { schema_version: 1, checkouts: {} });
  const members = validateManifest(shared), bindings = validateBindings(local);
  const manifest = shared as WorkspaceManifest;
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
    requireWorkspace(selected.has(id) && selected.get(id)![0] !== 'register', `Source and review options need a selected analyze/init member: ${id}`); relativePath(file);
  }
  const analysis = new Map<string, Source[]>(), languages = new Map<string, string>();
  const documentInventories = new Map<string, DocumentInventory>();
  for (const [id, [mode, record]] of selected) {
    const old = Object.hasOwn(members, id) ? members[id] : undefined;
    requireWorkspace(!old?.remote || old.remote === record.remote, `Checkout identity changed for ${id}; review the shared member before rebinding it.`);
    for (const [otherId, binding] of Object.entries(bindings)) requireWorkspace(otherId === id || record.git_common_dir !== binding.git_common_dir, `${id} and ${otherId} refer to the same Git repository.`);
    const member: Member = { ...old, id, mode };
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
  validateManifest(manifest);
  requireWorkspace(equal(before, fileState(paths)), 'Workspace files changed while planning. Preview again.');
  const request: PlanRequest = { language, member_languages: overrides, members: [...selected].map(([id, [mode, record]]) => [id, mode, record.path]) };
  if (reviews.length) request.reviews = reviews;
  if (sourceFiles.length) request.source_files = sourceFiles;
  if (options.profile !== undefined) request.profile = structuredClone(options.profile);
  return { schema_version: 1, workspace: root, before, request, selections: Object.fromEntries([...selected].map(([id, [, record]]) => [id, record])),
    effective_languages: Object.fromEntries(languages), analysis: Object.fromEntries(analysis), document_consolidation: Object.fromEntries(documentInventories), shared: manifest, local: local as LocalManifest };
}
export interface ApplyOptions { write?: typeof atomicWrite }
export function applyPlan(input: unknown, options: ApplyOptions = {}) {
  schema(input);
  requireWorkspace(typeof input.workspace === 'string' && isObject(input.request), 'Invalid plan. Create a new preview with the plan command.');
  const old = input as unknown as WorkspacePlan, request = old.request, root = old.workspace;
  const planOptions = { reviews: request.reviews, sourceFiles: request.source_files, profile: request.profile };
  let fresh = makePlan(root, request.members, request.language, request.member_languages, planOptions);
  requireWorkspace(equal(fresh, old), 'The workspace, selected checkout, or analysis changed since preview. Create a new plan.');
  let paths = manifestPaths(root);
  const state = path.dirname(paths[MANIFEST]);
  fs.mkdirSync(state, { recursive: true }); paths = manifestPaths(root);
  const lock = path.join(state, '.workspace.lock');
  try { fs.mkdirSync(lock); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; throw new WorkspaceError(`Apply is locked: ${lock}. Recover the interrupted apply and create a new plan.`); }
  const backups = new Map<string, { content: Buffer; mode: number } | null>(), written = new Map<string, string>(), changes: string[] = [];
  const write = options.write ?? atomicWrite;
  try {
    fresh = planInternal(root, request.members, request.language, request.member_languages, planOptions, true);
    requireWorkspace(equal(fresh, old), 'Workspace changed before the apply lock was acquired. Create a new plan.');
    for (const [name, file] of Object.entries(paths)) { const info = stat(file); backups.set(name, info ? { content: fs.readFileSync(file), mode: info.mode & 0o777 } : null); }
    const original = backups.get('.gitignore')?.content.toString('utf8') ?? '';
    const rules = ['/.workspace.lock/', '/' + LOCAL];
    const lines = original.split(/\r?\n/); if (lines.at(-1) === '') lines.pop();
    let desired = original;
    if (!equal(lines.slice(-2), rules)) desired += (original && !original.endsWith('\n') ? '\n' : '') + rules.join('\n') + '\n';
    const payloads: Array<[string, string, number]> = [['.gitignore', desired, 0o644], [LOCAL, json(fresh.local), 0o600], [MANIFEST, json(fresh.shared), 0o644]];
    for (const [name, content, mode] of payloads) {
      const file = paths[name];
      if (name !== '.gitignore' && stat(file) && equal(readJson(file), name === LOCAL ? fresh.local : fresh.shared)) continue;
      if (stat(file) && fs.readFileSync(file).equals(Buffer.from(content))) continue;
      manifestPaths(root);
      requireWorkspace((stat(file) ? fileHash(file) : null) === fresh.before[name], `Workspace file changed during apply: ${file}`);
      if (name === LOCAL && git(root, 'rev-parse', '--show-toplevel')) requireWorkspace(git(root, 'check-ignore', '--quiet', '--', `.harness/${LOCAL}`) !== null, `Git does not ignore .harness/${LOCAL}; the local checkout file was left alone.`);
      write(file, content, mode); written.set(name, hash(content)); changes.push('.harness/' + name);
    }
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (const [name, digest] of [...written].reverse()) {
      const file = paths[name];
      try {
        if (!stat(file) || stat(file, false)?.isSymbolicLink() || fileHash(file) !== digest) { rollbackErrors.push(`${file}: changed by another writer`); continue; }
        const backup = backups.get(name);
        if (!backup) fs.unlinkSync(file); else write(file, backup.content, backup.mode);
      } catch { rollbackErrors.push(`${file}: restore failed`); }
    }
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
    if (git(root, 'rev-parse', '--show-toplevel') && git(root, 'check-ignore', '--quiet', '--', `.harness/${LOCAL}`) === null) errors.push(`Local checkout bindings are not Git-ignored: .harness/${LOCAL}`);
    const bindings = validateBindings(readJson(paths[LOCAL]));
    for (const id of Object.keys(bindings).sort()) if (!Object.hasOwn(members, id)) errors.push(`Local checkout has no shared member: ${id}`);
    for (const [id, member] of Object.entries(members)) {
      if (!Object.hasOwn(bindings, id)) { errors.push(`Missing local checkout binding: ${id}`); continue; }
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
