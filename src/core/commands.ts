/** Recognize literal entry points without evaluating shell syntax, Makefiles or package scripts. */
export interface DocumentCommand { document: string; line: number; command: string }
export type CommandReference = { kind: 'package'; script: string } | { kind: 'make'; targets: string[] }
  | { kind: 'file'; path: string } | { kind: 'unknown'; reason: string };
const start = /^(?:(?:npm|pnpm|yarn|bun)\s+(?:run|test|start)\b|make(?:\s|$)|(?:node|python3?|bash|sh)\s+|\.\/)/;
export function documentCommands(document: string, body: string): DocumentCommand[] {
  const result: DocumentCommand[] = [];
  let fence: string | undefined, shell = false;
  for (const [index, line] of body.split('\n').entries()) {
    const marker = /^\s*(`{3,}|~{3,})(\S*)/.exec(line);
    if (marker) { if (!fence) { fence = marker[1][0]; shell = /^(sh|bash|shell|console|zsh)$/.test(marker[2]); } else if (fence === marker[1][0]) fence = undefined; continue; }
    const snippets = fence ? (shell ? [line.trim().replace(/^\$\s+/, '')] : []) : [...line.matchAll(/`([^`\n]+)`/g)].map(match => match[1].trim());
    for (const command of snippets) if (start.test(command)) result.push({ document, line: index + 1, command });
  }
  return result;
}
export function commandReference(command: string): CommandReference {
  if (!/^[\w@%+.,/:=\s-]+$/.test(command)) return { kind: 'unknown', reason: 'Shell operators, quoting or substitutions need an explicit review' };
  const [tool, ...args] = command.trim().split(/\s+/);
  if (['npm', 'pnpm', 'yarn', 'bun'].includes(tool)) {
    const options = args.slice(0, args.includes('--') ? args.indexOf('--') : args.length);
    if (options.some(arg => /^(?:--(?:prefix|workspace|workspaces|cwd|filter|dir)(?:=|$)|-[Cw])/.test(arg))) return { kind: 'unknown', reason: 'Package directory/workspace selectors need an explicit project review' };
    const script = args[0] === 'run' ? args[1] : ['test', 'start'].includes(args[0]) ? args[0] : undefined;
    return script && !script.startsWith('-') ? { kind: 'package', script } : { kind: 'unknown', reason: 'Package invocation needs a literal script and explicit working directory' };
  }
  if (tool === 'make') return args.length && args.every(arg => /^[a-zA-Z0-9_.\/-]+$/.test(arg) && !arg.startsWith('-'))
    ? { kind: 'make', targets: args } : { kind: 'unknown', reason: 'Make options, assignments and implicit default targets need review' };
  const file = ['node', 'python', 'python3', 'bash', 'sh'].includes(tool) ? args[0] : tool.startsWith('./') ? tool : undefined;
  return file && !file.startsWith('-') ? { kind: 'file', path: file.replace(/^\.\//, '') } : { kind: 'unknown', reason: 'No supported literal script entry point' };
}
export function makeDeclarations(content: string): { targets: string[]; incomplete: boolean } {
  const targets = new Set<string>();
  // Includes, computed rules and conditional branches cannot be resolved without evaluating Make.
  const incomplete = /(?:^\s*(?:-?include|sinclude|ifeq|ifneq|ifdef|ifndef|define)\b)|\$|%/m.test(content);
  for (const line of content.split('\n')) {
    if (/^\s|^#/.test(line)) continue;
    const phony = /^\.PHONY\s*:\s*([a-zA-Z0-9_.\/-]+(?: +[a-zA-Z0-9_.\/-]+)*)\s*(?:#.*)?$/.exec(line);
    if (phony) for (const target of phony[1].split(/\s+/)) targets.add(target);
    const match = /^([a-zA-Z0-9_.\/-]+(?: +[a-zA-Z0-9_.\/-]+)*)\s*:(?!=)/.exec(line);
    if (match) for (const target of match[1].split(/\s+/)) if (!target.startsWith('.')) targets.add(target);
  }
  return { targets: [...targets], incomplete };
}
