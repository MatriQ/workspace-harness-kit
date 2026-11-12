import fs from 'node:fs';
import path from 'node:path';
import { evaluate, validateEvidence } from './core/evidence.js';
import type { EvidenceRecord, Verdict } from './core/types.js';
import { equal, isObject, sorted } from './core/json.js';
import { hash, readJson, stat } from './adapters/files.js';
import { object, requireEvidence, text, validateRefs } from './core/evidence.js';

export const AT = '2026-01-01T12:00:00+00:00';
export const CASES: Record<string, Verdict> = { complete: 'passed', 'healthy-old-version': 'failed', 'skipped-deployment': 'pending',
  'business-failure': 'failed', 'missing-component': 'pending', 'wrong-target': 'failed', 'expired-observation': 'pending',
  'retry-recovered': 'passed', 'incomparable-identities': 'pending', 'component-business-unbound': 'pending',
  'component-business-wrong-artifact': 'failed', 'component-business-valid': 'passed' };
export interface RunMeasurement {
  schema_version: 1; agent: string; model: string; variant: 'baseline' | 'candidate'; skill_sha256: string;
  elapsed_seconds: number; input_tokens: number | null; output_tokens: number | null; cost_usd: number | null;
  human_interventions: number; smoke_executed: boolean | null; transcript_ref: string;
}
export function validateMeasurement(value: unknown): asserts value is RunMeasurement {
  object(value, 'run measurement', ['schema_version', 'agent', 'model', 'variant', 'skill_sha256', 'elapsed_seconds', 'input_tokens', 'output_tokens', 'cost_usd', 'human_interventions', 'smoke_executed', 'transcript_ref']);
  requireEvidence(value.schema_version === 1 && ['baseline', 'candidate'].includes(String(value.variant)), 'Invalid run metadata version or variant');
  text(value.agent, 'agent'); text(value.model, 'model');
  requireEvidence(typeof value.skill_sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.skill_sha256), 'Skill digest must be SHA-256');
  for (const key of ['elapsed_seconds', 'input_tokens', 'output_tokens', 'cost_usd', 'human_interventions']) {
    const item = value[key];
    requireEvidence((['input_tokens', 'output_tokens', 'cost_usd'].includes(key) && item === null) || (typeof item === 'number' && Number.isFinite(item) && item >= 0 && (!['input_tokens', 'output_tokens', 'human_interventions'].includes(key) || Number.isSafeInteger(item))), `Invalid ${key}; unavailable measurements must be null`);
  }
  requireEvidence(typeof value.smoke_executed === 'boolean' || value.smoke_executed === null, 'smoke_executed must be boolean or null'); validateRefs([value.transcript_ref]);
}
export function skillDigest(directory: string): string {
  const entries: Array<[string, string]> = [];
  function walk(folder: string) {
    for (const item of fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (item.name === '__pycache__' || item.name.endsWith('.pyc')) continue;
      const file = path.join(folder, item.name);
      if (item.isDirectory()) walk(file);
      else if (item.isFile()) entries.push([path.relative(directory, file).split(path.sep).join('/'), hash(fs.readFileSync(file))]);
      else throw new Error('Exercise Skills must contain ordinary files and directories');
    }
  }
  walk(directory); return hash(JSON.stringify(entries));
}
export class Exercises {
  readonly skill: string;
  constructor(root: string) { this.skill = path.join(root, 'skills/harness-verify-release'); }
  fixture(scenario: string): EvidenceRecord {
    if (!Object.hasOwn(CASES, scenario)) throw new Error('Unknown exercise scenario');
    const record = readJson(path.join(this.skill, 'assets/example-release.json')); validateEvidence(record);
    switch (scenario) {
      case 'healthy-old-version': record.observations[1].artifact!.value = 'd'.repeat(40); break;
      case 'skipped-deployment': record.observations[0].status = 'not run'; break;
      case 'business-failure': record.observations.at(-1)!.status = 'failed'; break;
      case 'missing-component': record.observations = record.observations.filter(item => item.component !== 'worker'); break;
      case 'wrong-target': record.observations[0].target.environment = 'other'; break;
      case 'expired-observation': record.observations[0].observed_at = '2026-01-01T10:00:00Z'; break;
      case 'retry-recovered': {
        const retry = structuredClone(record.observations[0]); retry.attempt = 2;
        record.observations[0].status = 'failed'; record.observations.push(retry); break;
      }
      case 'incomparable-identities': record.observations[1].artifact = { kind: 'oci_index_digest', value: 'sha256:' + 'a'.repeat(64) }; break;
    }
    if (scenario.startsWith('component-business-')) {
      const component = record.scope.components[0]; component.required_checks.push('business'); delete component.not_applicable.business;
      component.criteria.business = 'The selected API artifact returns the accepted greeting';
      record.observations.push({ component: component.id, check: 'business', attempt: 1, status: 'passed', target: structuredClone(record.scope.target), observed_at: AT,
        summary: 'The observed API returned the accepted greeting', evidence: ['fixture:api-business-probe'],
        ...(scenario === 'component-business-unbound' ? {} : { artifact: scenario === 'component-business-valid' ? structuredClone(component.artifact) : { kind: 'git_commit', value: 'd'.repeat(40) } }) });
    }
    return record;
  }
  prepare(scenario: string, directory: string, skillSource = this.skill) {
    const record = this.fixture(scenario);
    fs.mkdirSync(directory, { recursive: true });
    if (fs.readdirSync(directory).length) throw new Error('Choose an empty exercise directory');
    fs.writeFileSync(path.join(directory, 'release.json'), JSON.stringify(record, null, 2) + '\n');
    const digest = skillDigest(skillSource);
    fs.cpSync(skillSource, path.join(directory, 'skills/harness-verify-release'), { recursive: true,
      filter: file => path.basename(file) !== '__pycache__' && !file.endsWith('.pyc') });
    fs.writeFileSync(path.join(directory, 'request.md'), 'Use the harness-verify-release Skill at skills/harness-verify-release/SKILL.md.\n\n'
      + 'Determine whether the release in release.json is ready for its declared target and scope. '
      + `This is an offline exercise evaluated at ${AT}; use that time for freshness checks. `
      + 'Use only the supplied local evidence. Preserve release.json. '
      + "Write answer.json using the bundled evaluator's result format, including each check and attempt history. "
      + 'Explain the outcome and the next action in answer.md.\n');
    return { scenario, directory, status: 'prepared', agent_run: 'not run', skill_sha256: digest };
  }
  assess(scenario: string, directory: string) {
    const original = this.fixture(scenario), supplied = readJson(path.join(directory, 'release.json'));
    const answer = readJson(path.join(directory, 'answer.json')), expected = evaluate(original, AT), failures: string[] = [];
    if (!equal(supplied, original)) failures.push('The input evidence or scope was changed');
    if (!equal(answer, expected)) failures.push('The verdict, per-check results, or retained attempt history differs from the independent result');
    const narrative = path.join(directory, 'answer.md'), metadata = path.join(directory, 'run-metadata.json');
    if (!stat(narrative)?.isFile() || !fs.readFileSync(narrative, 'utf8').trim()) failures.push('Missing human-readable explanation');
    // Preserve the original ASCII fixture checksum convention (Python JSON's default separators).
    function canonical(value: unknown): string {
      if (Array.isArray(value)) return '[' + value.map(canonical).join(', ') + ']';
      if (isObject(value)) return '{' + Object.entries(sorted(value) as Record<string, unknown>).map(([key, item]) => JSON.stringify(key) + ': ' + canonical(item)).join(', ') + '}';
      return JSON.stringify(value);
    }
    let measurement: RunMeasurement | undefined;
    if (stat(metadata)) {
      const value = readJson(metadata); validateMeasurement(value); measurement = value;
      if (measurement.skill_sha256 !== skillDigest(path.join(directory, 'skills/harness-verify-release'))) failures.push('Measured Skill digest differs from the exercised Skill');
    }
    return { scenario, assessment: failures.length ? 'failed' : 'passed', failures,
      verdict_correct: isObject(answer) && answer.verdict === expected.verdict,
      acceptance_decision_correct: isObject(answer) && ['passed', 'failed', 'pending', 'invalid'].includes(String(answer.verdict)) && (answer.verdict === 'passed') === (expected.verdict === 'passed'),
      false_pass: isObject(answer) && answer.verdict === 'passed' && expected.verdict !== 'passed',
      measurement: measurement ?? null, fixture_sha256: hash(canonical(original)),
      limits: 'Deterministic artifact checks; narrative quality and tool-use compliance require transcript review' };
  }
  checkFixtures() {
    const fixtures = Object.fromEntries(Object.keys(CASES).map(scenario => [scenario, evaluate(this.fixture(scenario), AT).verdict]));
    if (!equal(fixtures, CASES)) throw new Error('Fixture verdict mismatch');
    return { fixtures, agent_runs: 0 };
  }
  campaign(runs: unknown) {
    if (!Array.isArray(runs) || !runs.length) throw new Error('Campaign requires scenario/directory entries for actual runs');
    const seen = new Set<string>();
    const results = runs.map(run => {
      object(run, 'campaign run', ['scenario', 'directory']); text(run.scenario, 'scenario'); text(run.directory, 'directory');
      const directory = fs.realpathSync(run.directory); requireEvidence(!seen.has(directory), 'Cannot count one run twice'); seen.add(directory);
      const assessment = this.assess(run.scenario, directory); requireEvidence(assessment.measurement, 'Actual campaigns require measured run metadata, not fixture-only outputs'); return assessment;
    });
    const variants = ['baseline', 'candidate'].map(variant => {
      const rows = results.filter(row => row.measurement?.variant === variant);
      const sum = (key: 'elapsed_seconds' | 'input_tokens' | 'output_tokens' | 'cost_usd' | 'human_interventions') => rows.every(row => row.measurement![key] !== null) ? rows.reduce((total, row) => total + row.measurement![key]!, 0) : null;
      return { variant, agent_runs: rows.length, successful_runs: rows.filter(row => row.assessment === 'passed').length, correct_verdicts: rows.filter(row => row.verdict_correct).length,
        correct_acceptance_decisions: rows.filter(row => row.acceptance_decision_correct).length, false_passes: rows.filter(row => row.false_pass).length,
        smoke_runs: rows.every(row => row.measurement!.smoke_executed !== null) ? rows.filter(row => row.measurement!.smoke_executed).length : null,
        elapsed_seconds: sum('elapsed_seconds'), input_tokens: sum('input_tokens'), output_tokens: sum('output_tokens'), cost_usd: sum('cost_usd'), human_interventions: sum('human_interventions') };
    });
    const signature = (variant: string) => results.filter(row => row.measurement!.variant === variant).map(row => [row.scenario, row.fixture_sha256, row.measurement!.agent, row.measurement!.model].join(':')).sort();
    return { schema_version: 1, agent_runs: results.length, matched_inputs_and_models: equal(signature('baseline'), signature('candidate')), variants, results,
      limits: 'Metadata and transcripts must come from actual supervised agent runs. Matched inputs/models do not establish equal hidden context or permissions. Small samples do not establish general performance.' };
  }
}
