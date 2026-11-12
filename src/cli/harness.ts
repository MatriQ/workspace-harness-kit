import { applyHarnessPlan, makeHarnessPlan } from '../adapters/harness.js';
import { checkHarness } from '../adapters/harness-check.js';
import { harnessImpact, harnessSync } from '../adapters/harness-impact.js';
import { harnessDoctor } from '../adapters/harness-doctor.js';
import { readJson } from '../adapters/files.js';
import { isObject } from '../core/json.js';
import { flag, multiple, parse, required, stringOption, UsageError } from './args.js';

export function harnessMain(argv: string[]): number {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('Usage: harness plan --workspace DIR --spec FILE [--adopt PATH] > PLAN\n       harness apply --plan PLAN\n       harness <check|impact|sync> --workspace DIR [--local]\n       harness doctor --workspace DIR [--record FILE] [--run-probe ID] [--at ISO_TIME]\nPlans include reviewable file content. Doctor is read-only unless individual probes are selected with --run-probe; review their argv first. Sync reports drift without writing members.'); return 0;
  }
  try {
    const [command, ...args] = argv;
    let result: unknown;
    if (command === 'plan') {
      const { values } = parse(args, { workspace: required, spec: required, adopt: multiple });
      result = makeHarnessPlan(values.workspace as string, readJson(values.spec as string), { adopt: values.adopt as string[] });
    } else if (command === 'apply') {
      const { values } = parse(args, { plan: required }); result = applyHarnessPlan(readJson(values.plan as string));
    } else if (command === 'check') {
      const { values } = parse(args, { workspace: required, local: flag });
      const checked = checkHarness(values.workspace as string, Boolean(values.local));
      console.log(JSON.stringify(checked, null, 2)); return checked.status === 'passed' ? 0 : 1;
    } else if (command === 'impact' || command === 'sync') {
      const { values } = parse(args, { workspace: required, local: flag });
      if (command === 'impact') result = harnessImpact(values.workspace as string, Boolean(values.local));
      else { const report = harnessSync(values.workspace as string, Boolean(values.local)); console.log(JSON.stringify(report, null, 2)); return report.status === 'passed' ? 0 : report.status === 'failed' ? 1 : 2; }
    } else if (command === 'doctor') {
      const { values } = parse(args, { workspace: required, record: stringOption, 'run-probe': multiple, at: stringOption });
      const input = values.record ? readJson(values.record as string) : undefined;
      const record = isObject(input) && 'record' in input ? input.record : input;
      const report = harnessDoctor(values.workspace as string, { record, run: values['run-probe'] as string[], at: values.at as string });
      console.log(JSON.stringify(report, null, 2)); return report.status === 'passed' ? 0 : report.status === 'failed' ? 1 : 2;
    } else throw new UsageError('Expected plan, apply, check, impact, sync or doctor');
    console.log(JSON.stringify(result, null, 2)); return 0;
  } catch (error) { console.log(JSON.stringify({ status: 'invalid', error: (error as Error).message })); return 2; }
}
