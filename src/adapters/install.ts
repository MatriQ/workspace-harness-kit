import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { equal, fullMatch, isObject, json } from '../core/json.js';
import { expandUser, fileHash, hash, isWithin, readJson, resolvePath, stat } from './files.js';

const RECEIPT = '.workspace-harness-kit-install.json', LOCK = '.workspace-harness-kit-install.lock';
export class InstallError extends Error { override name = 'InstallError'; }
function requireInstall(condition: unknown, message: string): asserts condition { if (!condition) throw new InstallError(message); }
export function inventory(directory: string): Record<string, string> {
  const info = stat(directory, false);
  requireInstall(!info?.isSymbolicLink(), `Expected a regular directory: ${directory}`);
  if (!info) return {};
  requireInstall(info.isDirectory(), `Expected a directory: ${directory}`);
  const entries: Array<[string, string]> = [];
  function visit(parent: string, prefix: string): void {
    for (const child of fs.readdirSync(parent, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
      if (child.name === '__pycache__' || /\.py[co]$/.test(child.name)) continue;
      const file = path.join(parent, child.name), relative = prefix + child.name;
      requireInstall(!child.isSymbolicLink(), `Skill contains a symlink: ${file}`);
      if (child.isDirectory()) visit(file, relative + '/');
      else if (child.isFile()) entries.push([relative, fileHash(file)]);
      else throw new InstallError(`Skill contains a non-regular file: ${file}`);
    }
  }
  visit(directory, '');
  return Object.fromEntries(entries);
}
interface Receipt { schema_version: 1; skills: Record<string, { version: string; files: Record<string, string> }> }
function receipt(destination: string): Receipt {
  const file = path.join(destination, RECEIPT);
  requireInstall(!stat(file, false)?.isSymbolicLink(), 'Installation receipt cannot be a symlink');
  const value = readJson(file, { schema_version: 1, skills: {} });
  requireInstall(isObject(value) && value.schema_version === 1 && isObject(value.skills), 'Unsupported installation receipt');
  for (const [name, item] of Object.entries(value.skills)) {
    requireInstall(fullMatch(/^harness-[a-z0-9][a-z0-9-]*$/, name) && isObject(item) && isObject(item.files) && typeof item.version === 'string', 'Invalid installed Skill record');
    for (const digest of Object.values(item.files)) requireInstall(typeof digest === 'string' && fullMatch(/^[a-f0-9]{64}$/, digest), 'Invalid installed file hash');
  }
  return value as unknown as Receipt;
}
export interface InstallPlan {
  schema_version: 1; version: string; destination: string; skills: string[];
  entries: Record<string, { before: Record<string, string>; after: Record<string, string> }>;
  receipt_before: string | null; conflicts: string[];
}
export class Installer {
  readonly root: string;
  constructor(sourceRoot: string) { this.root = resolvePath(sourceRoot); }
  get version(): string { return fs.readFileSync(path.join(this.root, 'VERSION'), 'utf8').trim(); }
  plan(destination: string, skills: string[] = []): InstallPlan {
    destination = path.resolve(expandUser(destination));
    requireInstall(!stat(destination, false)?.isSymbolicLink(), 'Choose a regular destination directory');
    destination = resolvePath(destination);
    requireInstall(!isWithin(this.root, destination), 'Choose a destination outside the source checkout');
    requireInstall(!stat(path.join(destination, LOCK), false), 'Installation is locked; inspect the interrupted installer before removing its lock');
    const installed = receipt(destination);
    const available = fs.readdirSync(path.join(this.root, 'skills')).filter(name => stat(path.join(this.root, 'skills', name, 'SKILL.md'))?.isFile());
    requireInstall(Array.isArray(skills), 'Unknown Skill selection');
    const selected = [...new Set(skills.length ? skills : available)].sort();
    requireInstall(selected.every(name => typeof name === 'string' && fullMatch(/^harness-[a-z0-9][a-z0-9-]*$/, name) && available.includes(name)), 'Unknown Skill selection');
    const conflicts: string[] = [], entries: InstallPlan['entries'] = {};
    for (const name of selected) {
      const current = inventory(path.join(destination, name));
      const previous = installed.skills[name];
      if (!previous && stat(path.join(destination, name), false)) conflicts.push(`${name}: destination is not owned by this installer`);
      else if (previous && !equal(current, previous.files)) conflicts.push(`${name}: local files changed; preserve or reconcile them before upgrading`);
      entries[name] = { before: current, after: inventory(path.join(this.root, 'skills', name)) };
    }
    const file = path.join(destination, RECEIPT);
    return { schema_version: 1, version: this.version, destination, skills: selected, entries,
      receipt_before: stat(file) ? fileHash(file) : null, conflicts };
  }
  apply(input: unknown) {
    requireInstall(isObject(input) && typeof input.destination === 'string' && Array.isArray(input.skills), 'Invalid installation plan');
    const fresh = this.plan(input.destination, input.skills as string[]);
    requireInstall(equal(fresh, input), 'Source or destination changed after preview; create a new plan');
    const plan = fresh;
    requireInstall(!plan.conflicts.length, plan.conflicts.join('; '));
    const destination = plan.destination;
    fs.mkdirSync(destination, { recursive: true });
    const lock = path.join(destination, LOCK);
    try { fs.mkdirSync(lock); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; throw new InstallError('Another installer holds the destination lock'); }
    const changed: string[] = [], moved: string[] = [], published: string[] = [];
    let staging: string | undefined;
    try {
      const installed = receipt(destination), file = path.join(destination, RECEIPT);
      const oldReceipt = stat(file) ? fs.readFileSync(file) : null;
      requireInstall((oldReceipt ? hash(oldReceipt) : null) === plan.receipt_before, 'Installation receipt changed while acquiring the lock');
      for (const [name, entry] of Object.entries(plan.entries)) requireInstall(equal(inventory(path.join(destination, name)), entry.before)
        && equal(inventory(path.join(this.root, 'skills', name)), entry.after), 'Skill files changed while acquiring the lock');
      staging = fs.mkdtempSync(path.join(destination, '.install-'));
      try {
        for (const [name, entry] of Object.entries(plan.entries)) {
          installed.skills[name] = { version: plan.version, files: entry.after };
          if (equal(entry.before, entry.after)) continue;
          const prepared = path.join(staging, name), target = path.join(destination, name);
          fs.cpSync(path.join(this.root, 'skills', name), prepared, { recursive: true, dereference: false,
            filter: source => path.basename(source) !== '__pycache__' && !/\.py[co]$/.test(source) });
          requireInstall(equal(inventory(prepared), entry.after), 'Skill source changed during copying');
          requireInstall(equal(inventory(target), entry.before), 'Destination changed during copying');
          if (stat(target, false)) { fs.renameSync(target, path.join(staging, name + '.backup')); moved.push(name); }
          fs.renameSync(prepared, target); published.push(name); changed.push(name);
        }
        const payload = Buffer.from(json(installed));
        if (!oldReceipt?.equals(payload)) {
          // Recheck the receipt before replacing it; another writer's changes are never overwritten.
          requireInstall(!stat(file, false)?.isSymbolicLink() && (stat(file) ? fileHash(file) : null) === plan.receipt_before, 'Installation receipt changed during copying');
          const prepared = path.join(staging, RECEIPT);
          fs.writeFileSync(prepared, payload, { flag: 'wx' }); fs.renameSync(prepared, file);
        }
      } catch (error) {
        const recoveryErrors: string[] = [];
        for (const name of published.reverse()) {
          const target = path.join(destination, name);
          try {
            if (!equal(inventory(target), plan.entries[name].after)) recoveryErrors.push(name);
            else fs.rmSync(target, { recursive: true });
          } catch { recoveryErrors.push(name); }
        }
        for (const name of moved.reverse()) {
          const target = path.join(destination, name);
          try { if (stat(target, false)) recoveryErrors.push(name); else fs.renameSync(path.join(staging, name + '.backup'), target); }
          catch { recoveryErrors.push(name); }
        }
        if (recoveryErrors.length) {
          const recovery = path.join(destination, '.workspace-harness-kit-recovery-' + path.basename(staging).replace('.install-', ''));
          const retained = staging;
          staging = undefined; // Retain backups even when the recovery rename itself fails.
          try { fs.renameSync(retained, recovery); }
          catch { throw new InstallError(`Files changed during recovery; preserved current files and backups in ${retained}`); }
          throw new InstallError(`Files changed during recovery; preserved current files and backups in ${recovery}`);
        }
        throw error;
      }
    } finally {
      try { if (staging) fs.rmSync(staging, { recursive: true, force: true }); }
      finally { fs.rmdirSync(lock); }
    }
    return { version: plan.version, installed: plan.skills, changed };
  }
}
export function checkInstallation(destination: string) {
  destination = resolvePath(expandUser(destination));
  const installed = receipt(destination);
  requireInstall(Object.keys(installed.skills).length, 'No installed Skills recorded');
  const problems: string[] = [];
  for (const [name, entry] of Object.entries(installed.skills)) if (!equal(inventory(path.join(destination, name)), entry.files)) problems.push(`${name}: files differ from the installed version`);
  return { skills: Object.fromEntries(Object.entries(installed.skills).map(([name, item]) => [name, item.version])), problems };
}

export interface SetupOptions {
  agent?: 'codex' | 'claude' | 'both';
  destination?: string;
  skills?: string[];
  dryRun?: boolean;
}

/** Install the selected Skills using the same ownership and recovery contract as plan/apply. */
export function setupInstallation(sourceRoot: string, options: SetupOptions = {}, userDirectory = os.homedir()) {
  requireInstall(options.agent === undefined || ['codex', 'claude', 'both'].includes(options.agent), 'Expected agent codex, claude or both');
  requireInstall(options.destination === undefined || options.agent === undefined, 'Use either --agent or --destination, not both');
  const agent = options.agent ?? 'codex';
  const destinations = options.destination !== undefined ? [options.destination]
    : (agent === 'both' ? ['.agents', '.claude'] : [agent === 'codex' ? '.agents' : '.claude'])
      .map(folder => path.join(userDirectory, folder, 'skills'));
  const installer = new Installer(sourceRoot);
  // Resolve and inspect every target before writing; parent aliases may name the same destination.
  const plans = [...new Map(destinations.map(destination => {
    const plan = installer.plan(destination, options.skills);
    return [plan.destination, plan] as const;
  })).values()];
  if (options.dryRun) return { dry_run: true as const, plans };
  const conflicts = plans.flatMap(plan => plan.conflicts.map(conflict => `${plan.destination}: ${conflict}`));
  requireInstall(!conflicts.length, conflicts.join('; '));
  const installations = plans.map(plan => {
    const applied = installer.apply(plan);
    return { destination: plan.destination, ...applied, ...checkInstallation(plan.destination) };
  });
  return { dry_run: false as const, installations };
}
