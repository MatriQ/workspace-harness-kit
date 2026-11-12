import fs from 'node:fs';
import path from 'node:path';
import { commandReference, documentCommands, makeDeclarations } from '../core/commands.js';
import type { DocumentCommand } from '../core/commands.js';
import type { HarnessSpec } from '../core/harness.js';
import { isObject } from '../core/json.js';
import { sourcePath } from './harness.js';
import { readJson, stat, within } from './files.js';

export interface CommandResult extends DocumentCommand { member?: string; cwd?: string; status: 'passed' | 'failed' | 'pending'; reason: string; sources: string[] }
export function checkCommands(root: string, spec: HarnessSpec, documents: Array<{ path: string; body: string }>, local = false): CommandResult[] {
  const found: Array<DocumentCommand & { cwd?: string }> = documents.flatMap(document => documentCommands(document.path, document.body));
  for (const check of spec.ci?.checks ?? []) {
    for (const item of documentCommands('.github/workflows/harness-gate.yml', '```sh\n' + check.run + '\n```')) found.push({ ...item, cwd: check.working_directory });
  }
  const explicit = spec.command_checks ?? [];
  const result: CommandResult[] = [];
  for (const claim of explicit) if (!found.some(item => item.document === claim.document && item.command === claim.command)) {
    // Explicit claims also cover unsupported commands and non-Markdown generated artifacts.
    const document = documents.find(item => item.path === claim.document);
    if (document?.body.includes(claim.command)) found.push({ document: claim.document, command: claim.command, line: 0 });
    else result.push({ ...claim, line: 0, status: 'failed', reason: 'Declared command is absent from its generated document', sources: [] });
  }
  for (const item of found) {
    const context = explicit.find(claim => claim.document === item.document && claim.command === item.command);
    const row: CommandResult = { ...item, ...(context?.member ? { member: context.member } : {}), ...(context?.cwd ? { cwd: context.cwd } : {}), status: 'pending', reason: '', sources: [] };
    result.push(row);
    if (context?.phase === 'planned') { row.reason = `Planned instruction, not executed: ${context.reason}`; continue; }
    if (row.member && !local) { row.reason = 'Member command requires local checkout bindings and --local'; continue; }
    try {
      const reference = commandReference(item.command);
      if (reference.kind === 'unknown') { row.reason = reference.reason; continue; }
      const base = row.member ? path.dirname(sourcePath(root, { member: row.member, path: '__harness_context__' })) : root;
      const directory = row.cwd ? within(base, row.cwd) : base;
      const source = (file: string) => { row.sources.push([row.cwd, file].filter(Boolean).join('/')); return within(directory, file); };
      if (reference.kind === 'package') {
        const file = source('package.json');
        if (!stat(file)) { row.status = 'failed'; row.reason = 'No package.json in the documented working directory'; continue; }
        const pkg = readJson(file), scripts = isObject(pkg) && isObject(pkg.scripts) ? pkg.scripts : {};
        const declared = scripts[reference.script];
        row.status = Object.hasOwn(scripts, reference.script) && typeof declared === 'string' && declared.trim() ? 'passed' : 'failed';
        row.reason = row.status === 'passed' ? 'Script declared in package.json; execution not verified' : `Missing package script: ${reference.script}`;
      } else if (reference.kind === 'make') {
        const name = ['GNUmakefile', 'makefile', 'Makefile'].find(file => stat(within(directory, file))?.isFile());
        if (!name) { row.status = 'failed'; row.reason = 'No Makefile in the documented working directory'; continue; }
        const declarations = makeDeclarations(fs.readFileSync(source(name), 'utf8'));
        const missing = reference.targets.filter(target => !declarations.targets.includes(target));
        row.status = declarations.incomplete ? 'pending' : missing.length ? 'failed' : 'passed';
        row.reason = declarations.incomplete ? 'Dynamic, included or conditional Make rules require review' : missing.length ? `Missing Make targets: ${missing.join(', ')}` : 'Literal Make targets declared; execution not verified';
      } else {
        row.status = stat(source(reference.path))?.isFile() ? 'passed' : 'failed';
        row.reason = row.status === 'passed' ? 'Referenced script exists; execution not verified' : `Missing script: ${reference.path}`;
      }
    } catch { row.status = 'failed'; row.reason = 'Command context or declaration is invalid, unavailable or outside the selected checkout'; }
  }
  return result;
}
