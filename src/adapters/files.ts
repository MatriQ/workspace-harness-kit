import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { relativePath, WorkspaceError } from '../core/registry.js';

export function stat(file: string, follow = true): fs.Stats | undefined {
  try { return follow ? fs.statSync(file) : fs.lstatSync(file); }
  catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) return undefined;
    throw error;
  }
}
/** Like Path.resolve(strict=False): resolve existing ancestors, including parent symlinks. */
export function resolvePath(file: string): string {
  const absolute = path.resolve(file);
  try { return fs.realpathSync(absolute); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const parent = path.dirname(absolute);
    if (parent === absolute) throw error;
    return path.join(resolvePath(parent), path.basename(absolute));
  }
}
export function expandUser(file: string): string {
  return file === '~' ? os.homedir() : file.startsWith('~/') ? path.join(os.homedir(), file.slice(2)) : file;
}
export function isWithin(root: string, file: string): boolean {
  const rel = path.relative(root, file);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}
export function within(root: string, value: string): string {
  const file = path.join(root, relativePath(value));
  if (!isWithin(resolvePath(root), resolvePath(file))) throw new WorkspaceError(`File reference escapes its directory: ${value}`);
  return file;
}
export function hash(data: string | Buffer): string { return createHash('sha256').update(data).digest('hex'); }
export function fileHash(file: string): string { return hash(fs.readFileSync(file)); }
export function readJson(file: string, fallback?: unknown): unknown {
  if (!stat(file) && fallback !== undefined) return structuredClone(fallback);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown; }
  catch (error) { throw new Error(`Could not read JSON from ${file}: ${(error as Error).message}`); }
}
export function atomicWrite(file: string, content: Buffer | string, mode: number): void {
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}`);
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(temporary, 'wx', mode);
    fs.writeFileSync(descriptor, content);
    fs.fchmodSync(descriptor, mode);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor); descriptor = undefined;
    fs.renameSync(temporary, file);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fs.rmSync(temporary, { force: true });
  }
}
