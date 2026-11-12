import path from 'node:path';
import { readJson } from '../adapters/files.js';
import { evaluate, markdown, validateEvidence } from '../core/evidence.js';
import { checkWorkspaceScope } from '../core/registry.js';
import { parse, stringOption, UsageError } from './args.js';

export function evidenceMain(argv: string[]): number {
  if (argv.includes('--help') || argv.includes('-h')) { console.log('Usage: evidence RECORD [--at ISO_TIME] [--workspace PATH] [--format json|markdown]'); return 0; }
  try {
    const { values, positionals } = parse(argv, { at: stringOption, workspace: stringOption, format: stringOption }, 1);
    if (values.format !== undefined && !['json', 'markdown'].includes(values.format as string)) throw new UsageError('--format must be json or markdown');
    const record = readJson(positionals[0]); validateEvidence(record);
    if (values.workspace) checkWorkspaceScope(record, readJson(path.join(values.workspace as string, '.harness/workspace.json')));
    const result = evaluate(record, values.at as string | undefined);
    console.log(values.format === 'markdown' ? markdown(result) : JSON.stringify(result, null, 2));
    return { passed: 0, failed: 1, pending: 2 }[result.verdict];
  } catch (error) { console.log(JSON.stringify({ verdict: 'invalid', error: (error as Error).message })); return 2; }
}
