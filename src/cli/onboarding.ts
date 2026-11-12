import { readJson } from '../adapters/files.js';
import { inspectToolchain } from '../adapters/onboarding.js';
import { planOnboarding } from '../core/onboarding.js';
import { parse, UsageError } from './args.js';

export function onboardingMain(argv: string[]): number {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('Usage: onboarding plan PROFILE_JSON | tools PROFILE_JSON\nplan reports unanswered questions, required tools and document topics.\ntools runs only local version probes; it does not install tools or authenticate.'); return 0;
  }
  try {
    const [command, ...args] = argv;
    if (!['plan', 'tools'].includes(command)) throw new UsageError('Expected plan or tools');
    const { positionals: [file] } = parse(args, {}, 1), profile = readJson(file);
    const result = command === 'plan' ? planOnboarding(profile) : inspectToolchain(profile);
    console.log(JSON.stringify(result, null, 2));
    return command === 'tools' && result.status === 'pending' ? 2 : 0;
  } catch (error) { console.log(JSON.stringify({ status: 'invalid', error: (error as Error).message })); return 2; }
}
