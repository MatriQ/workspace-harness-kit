import { checkHarness } from '../adapters/harness-check.js';
import { flag, parse, required } from '../cli/args.js';
try {
  const { values } = parse(process.argv.slice(2), { workspace: required, local: flag });
  const result = checkHarness(values.workspace as string, Boolean(values.local));
  console.log(JSON.stringify(result, null, 2)); process.exitCode = result.status === 'passed' ? 0 : 1;
} catch (error) { console.log(JSON.stringify({ status: 'invalid', error: (error as Error).message })); process.exitCode = 2; }
