import { applyPlan, checkWorkspace, discover, makePlan } from '../adapters/workspace.js';
import type { MemberOption, Selection } from '../adapters/workspace.js';
import { readJson } from '../adapters/files.js';
import { json } from '../core/json.js';
import { validateOnboarding } from '../core/onboarding.js';
import { flag, integer, multiple, parse, required, stringOption, UsageError } from './args.js';

export function workspaceMain(argv: string[]): number {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('Usage: workspace <discover|plan|apply|check> [options]\n'
      + 'discover [--repo PATH] [--directory PATH] [--depth N] [--include-nested]\n'
      + 'plan --workspace PATH [--member ID MODE PATH] [--language LOCALE] [--member-language ID LOCALE]\n'
      + '     [--source ID PATH] [--review-document ID PATH] [--profile PROFILE_JSON]\n'
      + 'apply --plan FILE\ncheck --workspace PATH [--local] [--strict]'); return 0;
  }
  try {
    const [command, ...args] = argv;
    let result: unknown, status = 0;
    if (command === 'discover') {
      const { values } = parse(args, { repo: multiple, directory: multiple, depth: stringOption, 'include-nested': flag });
      result = discover({ repo: values.repo as string[] | undefined, directory: values.directory as string[] | undefined,
        depth: values.depth === undefined ? 3 : integer(values.depth, '--depth'), includeNested: Boolean(values['include-nested']) });
    } else if (command === 'plan') {
      const { values } = parse(args, { workspace: required, member: { ...multiple, width: 3 }, language: stringOption,
        'member-language': { ...multiple, width: 2 }, source: { ...multiple, width: 2 }, 'review-document': { ...multiple, width: 2 }, profile: stringOption });
      const tuples = (key: string) => ((values[key] ?? []) as string[]).map(value => JSON.parse(value));
      const profile = values.profile ? readJson(values.profile as string) : undefined;
      if (profile !== undefined) validateOnboarding(profile);
      result = makePlan(values.workspace as string, tuples('member') as Selection[], (values.language ?? null) as string | null,
        tuples('member-language') as MemberOption[], { sourceFiles: tuples('source') as MemberOption[], reviews: tuples('review-document') as MemberOption[], profile });
    } else if (command === 'apply') {
      const { values } = parse(args, { plan: required }); result = applyPlan(readJson(values.plan as string));
    } else if (command === 'check') {
      const { values } = parse(args, { workspace: required, local: flag, strict: flag });
      if (values.strict && !values.local) throw new Error('--strict requires --local to check source and document freshness.');
      const checked = checkWorkspace(values.workspace as string, Boolean(values.local));
      status = Number(Boolean(checked.errors.length || (values.strict && checked.warnings.length))); result = checked;
    } else throw new UsageError('Expected discover, plan, apply, or check. Use --help for usage.');
    process.stdout.write(json(result)); return status;
  } catch (error) { console.error(`workspace: ${(error as Error).message}`); return error instanceof UsageError ? 2 : 1; }
}
