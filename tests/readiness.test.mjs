import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { evaluateReadiness } from '../dist/readiness.js';
import { validateReadinessPlan } from '../dist/index.js';
import { AT, ROOT, temporary, writeJson, run } from './helpers.mjs';
const plan = () => ({ schema_version: 1, release: 'greeting-1', target: { environment: 'staging', identity: 'greeting' }, artifacts: [{ component: 'api', artifact: { kind: 'package_version', value: '1.0.0' } }], max_age_seconds: 60,
  checks: [{ id: 'image-present', area: 'artifact', criterion: 'Exact artifact is retrievable' }, { id: 'rollback-rehearsed', area: 'rollback', criterion: 'Previous version restore was rehearsed for this change' }, { id: 'alerts-routed', area: 'monitoring', criterion: 'Synthetic alert reached the existing owner' }],
  not_applicable: { migration: 'This release changes no persistent schema or data.', review: 'The existing project review is outside this local rehearsal scope.' } });
function record(spec) {
  const binding = evaluateReadiness(spec, undefined, AT).binding;
  return { schema_version: 1, observations: spec.checks.map(check => ({ check: check.id, attempt: 1, binding, status: 'passed', target: structuredClone(spec.target), observed_at: AT, summary: check.criterion, evidence: ['fixture:rehearsal'], method: 'attestation' })) };
}
test('readiness separates missing evidence, failed rollback, retry recovery and deployment authorization', () => {
  const spec = plan(); assert.equal(evaluateReadiness(spec, undefined, AT).decision, 'pending');
  const observations = record(spec);
  assert.equal(evaluateReadiness(spec, observations, AT).decision, 'ready');
  observations.observations[1].status = 'failed';
  assert.equal(evaluateReadiness(spec, observations, AT).decision, 'not-ready');
  observations.observations.push({ ...observations.observations[1], attempt: 2, status: 'passed' });
  const report = evaluateReadiness(spec, observations, AT);
  assert.equal(report.decision, 'ready'); assert.equal(report.checks[1].recovered, true); assert.equal(report.deployment, 'not run');
  assert.match(report.authorization, /existing project/);
});
test('readiness cannot reuse observations for changed artifact, plan, target or expired time', () => {
  const spec = plan(), observations = record(spec);
  assert.equal(evaluateReadiness(spec, observations, '2026-01-01T12:01:01Z').decision, 'pending');
  spec.artifacts[0].artifact.value = '1.0.1'; assert.equal(evaluateReadiness(spec, observations, AT).decision, 'pending');
  spec.target.identity = 'different'; assert.equal(evaluateReadiness(spec, observations, AT).decision, 'not-ready');
  delete spec.not_applicable.migration; assert.throws(() => validateReadinessPlan(spec), /Classify every/);
});
test('installed readiness CLI emits pending templates and evaluates supplied records', t => {
  const folder = temporary(t), spec = plan(), cli = path.join(ROOT, 'skills/harness-verify-release/scripts/readiness.mjs');
  writeJson(path.join(folder, 'plan.json'), spec); writeJson(path.join(folder, 'record.json'), record(spec));
  assert.equal(JSON.parse(run(cli, ['--plan', path.join(folder, 'plan.json'), '--at', AT], { code: 2 }).stdout).decision, 'pending');
  assert.equal(JSON.parse(run(cli, ['--plan', path.join(folder, 'plan.json'), '--record', path.join(folder, 'record.json'), '--at', AT]).stdout).decision, 'ready');
});
