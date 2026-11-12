import { parseArgs } from 'node:util';
import { fullMatch } from '../core/json.js';
export class UsageError extends Error { override name = 'UsageError'; }
interface Option { type: 'string' | 'boolean'; multiple?: boolean; width?: number; required?: boolean }
export function parse(argv: string[], specs: Record<string, Option>, count = 0) {
  const normalized: string[] = [];
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index], option = specs[arg.slice(2)];
    if (arg.startsWith('--') && option?.width) {
      const parts = argv.slice(index + 1, index + 1 + option.width);
      if (parts.length !== option.width || parts.some(part => part.startsWith('--'))) throw new UsageError(`${arg} needs ${option.width} values`);
      normalized.push(arg, JSON.stringify(parts)); index += option.width;
    } else normalized.push(arg);
  }
  try {
    const options = Object.fromEntries(Object.entries(specs).map(([name, { type, multiple }]) => [name, { type, multiple: multiple ?? false }]));
    const result = parseArgs({ args: normalized, options, allowPositionals: true, strict: true });
    for (const [name, spec] of Object.entries(specs)) if (spec.required && result.values[name] === undefined) throw new UsageError(`Missing required --${name}`);
    if (result.positionals.length !== count) throw new UsageError(`Expected ${count} positional argument(s)`);
    return result;
  } catch (error) { throw new UsageError((error as Error).message); }
}
export const stringOption = { type: 'string' as const };
export const required = { type: 'string' as const, required: true };
export const flag = { type: 'boolean' as const };
export const multiple = { type: 'string' as const, multiple: true };
export function integer(value: unknown, name: string): number {
  if (typeof value !== 'string' || !fullMatch(/^-?\d+$/, value) || !Number.isSafeInteger(Number(value))) throw new UsageError(`${name} must be an integer`);
  return Number(value);
}
