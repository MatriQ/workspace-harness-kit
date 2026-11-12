import { fileURLToPath } from 'node:url';
import { Exercises } from '../evals.js';
import { parse, stringOption } from '../cli/args.js';
import { readJson } from '../adapters/files.js';
try {
  const [command, ...args] = process.argv.slice(2), exercises = new Exercises(fileURLToPath(new URL('../', import.meta.url)));
  if (['--help', '-h'].includes(command)) console.log('Usage: run check-fixtures | prepare SCENARIO DIRECTORY [--skill-source DIR] | assess SCENARIO DIRECTORY | campaign RUNS_JSON');
  else if (command === 'check-fixtures') { parse(args, {}); console.log(JSON.stringify(exercises.checkFixtures(), null, 2)); }
  else if (command === 'prepare' || command === 'assess') {
    const { values, positionals: [scenario, directory] } = parse(args, command === 'prepare' ? { 'skill-source': stringOption } : {}, 2);
    const result = command === 'prepare' ? exercises.prepare(scenario, directory, values['skill-source'] as string | undefined) : exercises.assess(scenario, directory);
    console.log(JSON.stringify(result, null, 2));
    if ('assessment' in result && result.assessment === 'failed') process.exitCode = 1;
  } else if (command === 'campaign') {
    const { positionals: [file] } = parse(args, {}, 1); console.log(JSON.stringify(exercises.campaign(readJson(file)), null, 2));
  } else throw new Error('Expected check-fixtures, prepare, assess or campaign');
} catch (error) { console.log(JSON.stringify({ assessment: 'invalid', error: (error as Error).message })); process.exitCode = 2; }
