import { evaluateReadiness } from '../adapters/readiness.js';
import { readJson } from '../adapters/files.js';
import { isObject } from '../core/json.js';
import { parse, required, stringOption } from './args.js';

export function readinessMain(argv: string[]): number {
  if (argv.includes('--help') || argv.includes('-h')) { console.log('Usage: readiness --plan FILE [--record FILE] [--at ISO_TIME]\nWithout a record, emit the binding and pending checks. Accepts a verification record or a previous readiness report. No deployment commands are executed.'); return 0; }
  try {
    const { values } = parse(argv, { plan: required, record: stringOption, at: stringOption });
    const input = values.record ? readJson(values.record as string) : undefined;
    const report = evaluateReadiness(readJson(values.plan as string), isObject(input) && 'record' in input ? input.record : input, values.at as string);
    console.log(JSON.stringify(report, null, 2)); return report.status === 'passed' ? 0 : report.status === 'failed' ? 1 : 2;
  } catch (error) { console.log(JSON.stringify({ status: 'invalid', error: (error as Error).message })); return 2; }
}
