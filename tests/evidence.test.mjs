import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { evaluate, markdown, checkWorkspaceScope, EvidenceError, timestamp } from '../dist/index.js';
import { Exercises } from '../dist/evals.js';
import { AT, ROOT, EVIDENCE, sample, temporary, run, readJson, writeJson } from './helpers.mjs';

const verdict = record => evaluate(record, AT);
test('complete release, Markdown, and immutable caller data', () => {
  const record = sample(), before = structuredClone(record), result = verdict(record);
  assert.equal(result.verdict, 'passed'); assert.equal(result.checks.length, 13);
  assert.match(markdown(result), /fixture:journey\/1/); assert.deepEqual(record, before);
  result.target.identity = 'changed'; assert.deepEqual(record, before);
});
test('healthy old artifact fails independently of passing technical checks', () => {
  const record = sample(); record.observations[1].artifact.value = 'd'.repeat(40);
  const result = verdict(record); assert.equal(result.verdict, 'failed');
  assert.equal(result.checks.find(row => row.id === 'api' && row.check === 'technical').status, 'passed');
});
test('skipped deployment stays not run and release stays pending', () => {
  const record = sample(); record.observations[0].status = 'not run';
  const result = verdict(record); assert.equal(result.verdict, 'pending');
  assert.equal(result.checks.find(row => row.check === 'deployment').status, 'not run');
});
test('missing component observations stay pending', () => {
  const record = sample(); record.observations = record.observations.filter(item => item.component !== 'worker');
  const result = verdict(record); assert.equal(result.verdict, 'pending');
  assert.equal(result.checks.filter(row => row.status === 'pending').length, 3);
});
test('wrong target fails', () => {
  const record = sample(); record.observations[0].target.environment = 'other'; assert.equal(verdict(record).verdict, 'failed');
});
test('stale and future observations cannot pass', () => {
  for (const time of ['2026-01-01T11:00:00Z', '2026-01-02T12:00:00Z']) {
    const record = sample(); record.observations[0].observed_at = time; assert.equal(verdict(record).verdict, 'pending');
  }
});
test('different identity kinds and platform scopes need a mapping', () => {
  for (const artifact of [{ kind: 'oci_manifest_digest', value: 'sha256:' + 'a'.repeat(64) }, { kind: 'git_commit', value: 'a'.repeat(40), platform: 'linux/arm64' }]) {
    const record = sample(); record.observations[1].artifact = artifact; assert.equal(verdict(record).verdict, 'pending');
  }
});
test('journey is bound to every participating artifact', () => {
  for (const change of ['wrong', 'missing']) {
    const record = sample();
    if (change === 'wrong') record.observations.at(-1).artifacts.worker.value = 'd'.repeat(40);
    else delete record.observations.at(-1).artifacts.worker;
    assert.equal(verdict(record).verdict, change === 'wrong' ? 'failed' : 'pending');
  }
});
test('technical evidence requires the tested artifact and preserves reported result', () => {
  const record = sample(); delete record.observations[2].artifact; assert.equal(verdict(record).verdict, 'pending');
  record.observations[2].artifact = { kind: 'git_commit', value: 'd'.repeat(40) };
  const result = verdict(record); assert.equal(result.verdict, 'failed');
  const row = result.checks.find(row => row.id === 'api' && row.check === 'technical');
  assert.equal(row.attempts[0].artifact.value, 'd'.repeat(40)); assert.equal(row.attempts[0].reported_status, 'passed');
});
test('business failure is independent of version checks', () => {
  const record = sample(); record.observations.at(-1).status = 'failed'; const result = verdict(record);
  assert.equal(result.verdict, 'failed'); assert.ok(result.checks.filter(row => row.check === 'version').every(row => row.status === 'passed'));
});
test('component business results bind the tested artifact and preserve recovery history', () => {
  const record = sample(), component = record.scope.components[0];
  component.required_checks.push('business'); delete component.not_applicable.business;
  component.criteria.business = 'The expected artifact produces the business result';
  const observation = { component: 'api', check: 'business', attempt: 1, status: 'passed', target: record.scope.target,
    observed_at: AT, summary: 'Business probe completed', evidence: ['fixture:business/1'] };
  record.observations.push(observation);
  assert.equal(verdict(record).verdict, 'pending', 'Legacy unbound observations remain readable but cannot pass');
  observation.artifact = { kind: 'git_commit', value: 'd'.repeat(40) };
  assert.equal(verdict(record).verdict, 'failed');
  record.observations.push({ ...observation, attempt: 2, artifact: component.artifact });
  const result = verdict(record), row = result.checks.find(item => item.id === 'api' && item.check === 'business');
  assert.equal(result.verdict, 'passed'); assert.deepEqual(row.expected_artifact, component.artifact);
  assert.deepEqual(row.attempts.map(item => item.status), ['failed', 'passed']); assert.equal(row.recovered, true);
});
test('retry retains failures and marks recovery', () => {
  const record = sample(), retry = structuredClone(record.observations[0]);
  record.observations[0].status = 'failed'; retry.attempt = 2; record.observations.push(retry);
  const result = verdict(record), row = result.checks.find(row => row.id === 'api' && row.check === 'deployment');
  assert.equal(result.verdict, 'passed'); assert.equal(row.recovered, true);
  assert.deepEqual(row.attempts.map(item => item.status), ['failed', 'passed']); assert.match(markdown(result), /attempt 1: failed/);
  retry.observed_at = '2026-01-01T11:59:59Z'; assert.throws(() => verdict(record), /predate/);
});
test('invalid contracts cannot pass', () => {
  const mutations = [
    r => r.scope.components = [], r => r.scope.components[0].not_applicable.business = '',
    r => r.scope.components[0].required_checks.pop(), r => r.observations[0].evidence = [],
    r => r.observations[0].status = 'success', r => r.observations[0].attempt = true,
    r => r.observations.push(structuredClone(r.observations[0])), r => r.scope.components[0].artifact.value = 'main',
    r => r.observations[0].evidence = ['https://example.invalid/run?token=synthetic'],
    r => r.observations[0].evidence = ['https://synthetic:secret@example.invalid/run'],
    r => r.observations[0].evidence = ['raw\nlog'], r => r.observations[0].artifact = null,
    r => r.scope.extra = 1, r => r.schema_version = true,
    r => r.observations[0].journey = 'greeting', r => r.scope.max_age_seconds = Number.MAX_SAFE_INTEGER + 1,
  ];
  for (const mutate of mutations) { const record = sample(); mutate(record); assert.throws(() => verdict(record), EvidenceError); }
});
test('timestamp rejects invalid calendars, timezone omissions and rollover', () => {
  for (const time of ['2026-02-30T12:00:00Z', '2026-01-01T24:00:00Z', '2026-01-01T12:00:00', '2026-01-01T12:00:00+25:00']) assert.throws(() => timestamp(time), EvidenceError);
  assert.equal(timestamp('2026-01-01T20:00:00+08:00'), timestamp(AT));
  assert.equal(evaluate(sample(), '2026-01-01T20:00:00+08:00').evaluated_at, AT);
});
test('trailing newlines cannot bypass full identifier, digest or timestamp validation', () => {
  for (const mutate of [r => r.capability += '\n', r => r.scope.components[0].artifact.value += '\n', r => r.observations[0].observed_at += '\n']) {
    const record = sample(); mutate(record); assert.throws(() => verdict(record), EvidenceError);
  }
});
test('workspace scope requires transitive capability components', () => {
  const record = sample(), manifest = { schema_version: 1, members: ['api', 'client', 'worker'].map(id => ({ id })),
    capabilities: [{ id: 'greeting', requires: ['api'] }], relationships: [{ from: 'api', to: 'worker', type: 'requires' }] };
  checkWorkspaceScope(record, manifest);
  record.scope.components.pop(); assert.throws(() => checkWorkspaceScope(record, manifest), /worker/);
  manifest.capabilities[0].requires = 'api'; assert.throws(() => checkWorkspaceScope(record, manifest), /must be a list/);
});
test('evidence CLI keeps exit codes and workspace guard', t => {
  const root = temporary(t), file = path.join(root, 'record.json');
  for (const code of [0, 1, 2]) {
    const record = sample(); if (code) record.observations[0].status = code === 1 ? 'failed' : 'not run';
    writeJson(file, record); run(EVIDENCE, [file, '--at', AT], { code });
  }
  fs.writeFileSync(file, '{}'); assert.equal(JSON.parse(run(EVIDENCE, [file], { code: 2 }).stdout).verdict, 'invalid');
  writeJson(file, sample()); fs.mkdirSync(path.join(root, '.harness'));
  writeJson(path.join(root, '.harness/workspace.json'), { schema_version: 1, members: [{ id: 'omitted' }], capabilities: [{ id: 'greeting', requires: ['omitted'] }] });
  run(EVIDENCE, [file, '--at', AT, '--workspace', root], { code: 2 });
});
test('all nine complete results match independent Python baseline fingerprints', () => {
  const golden = readJson(path.join(ROOT, 'tests/fixtures/python-v1-golden.json')), exercises = new Exercises(ROOT);
  const sort = value => Array.isArray(value) ? value.map(sort) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])])) : value;
  for (const [scenario, expected] of Object.entries(golden.cases)) {
    const result = evaluate(exercises.fixture(scenario), golden.at);
    assert.equal(result.verdict, expected.verdict, scenario);
    assert.equal(createHash('sha256').update(JSON.stringify(sort(result))).digest('hex'), expected.result_sha256, scenario);
  }
});
