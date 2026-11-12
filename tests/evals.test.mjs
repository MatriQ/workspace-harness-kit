import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Exercises, AT, CASES, skillDigest } from '../dist/evals.js';
import { evaluate } from '../dist/index.js';
import { ROOT, temporary, writeJson, run } from './helpers.mjs';

const exercises = new Exercises(ROOT);
test('all offline exercise expectations hold without model runs', () => {
  assert.deepEqual(exercises.checkFixtures(), { fixtures: CASES, agent_runs: 0 });
});
test('assessor rejects false passes, missing narratives and modified input', t => {
  const directory = temporary(t), prepared = exercises.prepare('healthy-old-version', directory); assert.equal(prepared.agent_run, 'not run');
  const result = evaluate(exercises.fixture('healthy-old-version'), AT); writeJson(path.join(directory, 'answer.json'), result);
  assert.equal(exercises.assess('healthy-old-version', directory).assessment, 'failed');
  fs.writeFileSync(path.join(directory, 'answer.md'), 'The old API version prevents acceptance.');
  assert.equal(exercises.assess('healthy-old-version', directory).assessment, 'passed');
  result.verdict = 'passed'; writeJson(path.join(directory, 'answer.json'), result); assert.equal(exercises.assess('healthy-old-version', directory).false_pass, true);
  writeJson(path.join(directory, 'release.json'), exercises.fixture('complete'));
  assert.ok(exercises.assess('healthy-old-version', directory).failures.includes('The input evidence or scope was changed'));
});
test('prepared exercise contains independently runnable evaluator and never overwrites files', t => {
  const directory = temporary(t); exercises.prepare('retry-recovered', directory);
  const script = path.join(directory, 'skills/harness-verify-release/scripts/evidence.mjs');
  assert.equal(JSON.parse(run(script, [path.join(directory, 'release.json'), '--at', AT], { cwd: directory }).stdout).verdict, 'passed');
  assert.throws(() => exercises.prepare('complete', directory), /empty/);
  const result = JSON.parse(run(path.join(ROOT, 'evals/run.mjs'), ['check-fixtures']).stdout); assert.equal(result.agent_runs, 0);
});
test('campaigns require actual-run metadata and retain unknown costs, false passes and matched inputs', t => {
  const root = temporary(t), runs = [];
  for (const variant of ['baseline', 'candidate']) {
    const directory = path.join(root, variant), scenario = 'component-business-unbound';
    exercises.prepare(scenario, directory);
    const answer = evaluate(exercises.fixture(scenario), AT); if (variant === 'baseline') answer.verdict = 'passed';
    writeJson(path.join(directory, 'answer.json'), answer); fs.writeFileSync(path.join(directory, 'answer.md'), 'Exercise outcome.');
    runs.push({ scenario, directory });
    assert.throws(() => exercises.campaign(runs), /metadata/);
    writeJson(path.join(directory, 'run-metadata.json'), { schema_version: 1, agent: 'synthetic-test-runner', model: 'fixture', variant,
      skill_sha256: skillDigest(path.join(directory, 'skills/harness-verify-release')), elapsed_seconds: 10, input_tokens: null, output_tokens: null, cost_usd: null,
      human_interventions: 0, smoke_executed: null, transcript_ref: 'fixture:metadata-validation-only' });
  }
  const campaign = exercises.campaign(runs); assert.equal(campaign.agent_runs, 2); assert.equal(campaign.matched_inputs_and_models, true);
  assert.equal(campaign.variants[0].false_passes, 1); assert.equal(campaign.variants[1].successful_runs, 1);
  assert.equal(campaign.variants[0].cost_usd, null); assert.equal(campaign.variants[0].input_tokens, null);
  assert.throws(() => exercises.campaign([...runs, runs[0]]), /count one run twice/);
  const metadata = path.join(runs[0].directory, 'run-metadata.json'), value = JSON.parse(fs.readFileSync(metadata)); value.cost_usd = -1; writeJson(metadata, value);
  assert.throws(() => exercises.campaign(runs), /Invalid cost/);
});
