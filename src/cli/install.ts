import { Installer, checkInstallation, setupInstallation, type SetupOptions } from '../adapters/install.js';
import { readJson } from '../adapters/files.js';
import { flag, multiple, parse, required, stringOption, UsageError } from './args.js';

export function installMain(argv: string[], sourceRoot: string): number {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('Usage: install --version | setup [--agent codex|claude|both | --destination PATH] [--skill NAME] [--dry-run] | plan --destination PATH [--skill NAME] | apply --plan FILE | check --destination PATH');
    return 0;
  }
  try {
    const installer = new Installer(sourceRoot);
    if (argv.length === 1 && argv[0] === '--version') { console.log(installer.version); return 0; }
    const [command, ...args] = argv;
    let result: unknown, status = 0;
    if (command === 'setup') {
      const { values } = parse(args, { agent: stringOption, destination: stringOption, skill: multiple, 'dry-run': flag });
      if (values.agent !== undefined && !['codex', 'claude', 'both'].includes(values.agent as string)) throw new UsageError('Expected --agent codex, claude or both');
      if (values.agent !== undefined && values.destination !== undefined) throw new UsageError('Use either --agent or --destination, not both');
      const setup = setupInstallation(sourceRoot, { agent: values.agent as SetupOptions['agent'], destination: values.destination as string | undefined,
        skills: values.skill as string[] | undefined, dryRun: values['dry-run'] as boolean | undefined });
      result = setup;
      status = Number(setup.dry_run ? setup.plans.some(plan => plan.conflicts.length) : setup.installations.some(installation => installation.problems.length));
    } else if (command === 'plan') {
      const { values } = parse(args, { destination: required, skill: multiple });
      const plan = installer.plan(values.destination as string, values.skill as string[] | undefined);
      result = plan; status = Number(plan.conflicts.length > 0);
    } else if (command === 'apply') {
      const { values } = parse(args, { plan: required }); result = installer.apply(readJson(values.plan as string));
    } else if (command === 'check') {
      const { values } = parse(args, { destination: required }); const checked = checkInstallation(values.destination as string);
      result = checked; status = Number(checked.problems.length > 0);
    } else throw new UsageError('Expected setup, plan, apply, or check. Use --help for usage.');
    console.log(JSON.stringify(result, null, 2)); return status;
  } catch (error) { console.error(`install: ${(error as Error).message}`); return error instanceof UsageError ? 2 : 1; }
}
