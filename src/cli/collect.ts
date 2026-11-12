import fs from 'node:fs';
import path from 'node:path';
import { ecsVersion, githubStep, junit, versionHttp } from '../adapters/collect.js';
import { readJson } from '../adapters/files.js';
import { identifier, requireEvidence, timestamp, validateArtifact, validateTarget } from '../core/evidence.js';
import { integer, parse, required, UsageError } from './args.js';

export async function collectMain(argv: string[]): Promise<number> {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('Usage: collect <github-step|version-http|junit|aws-ecs> --component ID --attempt N [options]\n'
      + 'github-step --input JOB_JSON --step NAME --target TARGET_JSON --observed-at ISO_TIME\n'
      + 'version-http --url URL\njunit --input XML --target TARGET_JSON --artifact ARTIFACT_JSON --observed-at ISO_TIME\naws-ecs --selection JSON_FILE (bounded read-only AWS CLI calls; verifies account first)'); return 0;
  }
  try {
    const [command, ...args] = argv;
    if (!['github-step', 'version-http', 'junit', 'aws-ecs'].includes(command)) throw new UsageError('Expected github-step, version-http, junit or aws-ecs');
    const common = { component: required, attempt: required };
    const specs = command === 'aws-ecs' ? { ...common, selection: required } : command === 'version-http' ? { ...common, url: required }
      : { ...common, input: required, target: required, 'observed-at': required, ...(command === 'junit' ? { artifact: required } : { step: required }) };
    const { values } = parse(args, specs);
    identifier(values.component, 'component');
    const attempt = integer(values.attempt, '--attempt'); requireEvidence(attempt > 0, 'attempt must be positive');
    let result: Record<string, unknown> = { component: values.component, attempt };
    if (command === 'aws-ecs') result = { ...result, ...ecsVersion(readJson(values.selection as string)), check: 'version', observed_at: new Date().toISOString() };
    else if (command === 'version-http') result = { ...result, ...await versionHttp(values.url as string), check: 'version', observed_at: new Date().toISOString() };
    else {
      const target = readJson(values.target as string); validateTarget(target); timestamp(values['observed-at']);
      result = { ...result, target, observed_at: values['observed-at'] };
      if (command === 'github-step') result = { ...result, ...githubStep(readJson(values.input as string), values.step as string), check: 'deployment' };
      else {
        const artifact = readJson(values.artifact as string); validateArtifact(artifact);
        result = { ...result, ...junit(fs.readFileSync(values.input as string, 'utf8')), check: 'technical', artifact, evidence: ['junit:' + path.basename(values.input as string)] };
      }
    }
    console.log(JSON.stringify(result, null, 2)); return 0;
  } catch (error) { console.log(JSON.stringify({ status: 'pending', error: (error as Error).message })); return 2; }
}
