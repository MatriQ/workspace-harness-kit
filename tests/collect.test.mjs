import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { githubStep, junit, versionHttp } from '../dist/collect.js';
import { ROOT, temporary, sample, writeJson, run } from './helpers.mjs';

test('a passing job cannot mask skipped deployment; selected step must be unique', () => {
  const job = { id: 1, run_id: 2, conclusion: 'success', html_url: 'https://example.invalid/jobs/1', steps: [{ name: 'Deploy', number: 3, status: 'completed', conclusion: 'skipped' }] };
  assert.equal(githubStep(job, 'Deploy').status, 'not run');
  job.steps[0].status = 'in_progress'; assert.equal(githubStep(job, 'Deploy').status, 'pending');
  job.steps.push({ ...job.steps[0] }); assert.throws(() => githubStep(job, 'Deploy'), /uniquely/);
});
test('JUnit counts observed and declared failures, incomplete results and skipped tests', () => {
  const cases = [
    ['<testsuite tests="1"><testcase name="ok"/></testsuite>', 'passed'],
    ['<testsuite tests="1"><testcase><failure/></testcase></testsuite>', 'failed'],
    ['<testsuite tests="1"><testcase><skipped/></testcase></testsuite>', 'pending'],
    ['<testsuite tests="0"/>', 'not run'], ['<testsuite tests="10"><testcase/></testsuite>', 'pending'],
    ['<testsuite tests="1" errors="1"><testcase/></testsuite>', 'failed'],
    ['<testsuites tests="2"><testsuite tests="1"><testcase/></testsuite><testsuite tests="1"><testcase/></testsuite></testsuites>', 'passed'],
    ['<j:testsuite xmlns:j="urn:junit" tests="1"><j:testcase/></j:testsuite>', 'passed'],
    ['<testsuite tests="1" skipped="1"><testcase/></testsuite>', 'pending'],
  ];
  for (const [xml, status] of cases) assert.equal(junit(xml).status, status, xml);
});
test('malformed, entity-bearing and multi-root XML cannot pass', () => {
  for (const xml of ['<testsuite>', '<testsuite/><testsuite/>', '<testsuite tests="-1"/>', '<not-junit/>',
    '<!DOCTYPE testsuite [<!ENTITY x "text">]><testsuite><testcase>&x;</testcase></testsuite>']) assert.throws(() => junit(xml));
});
async function server(t, handler) {
  const instance = http.createServer(handler); instance.listen(0, '127.0.0.1'); await once(instance, 'listening');
  t.after(() => new Promise((resolve, reject) => { instance.closeAllConnections(); instance.close(error => error ? reject(error) : resolve()); }));
  return `http://127.0.0.1:${instance.address().port}`;
}
test('HTTP probe preserves the observed target and artifact', async t => {
  const payload = { target: { environment: 'other', identity: 'synthetic/other' }, artifact: { kind: 'git_commit', value: 'a'.repeat(40) } };
  const url = await server(t, (_request, response) => { response.end(JSON.stringify(payload)); });
  const result = await versionHttp(url + '/version'); assert.deepEqual(result.target, payload.target); assert.deepEqual(result.artifact, payload.artifact);
});
test('HTTP probes reject redirects, oversized bodies and non-success status', async t => {
  let redirected = false;
  const url = await server(t, (request, response) => {
    if (request.url === '/redirect') { response.writeHead(302, { Location: '/target' }); response.end(); }
    else if (request.url === '/large') response.end(' '.repeat(65537));
    else if (request.url === '/target') { redirected = true; response.end('{}'); }
    else { response.writeHead(500); response.end('{}'); }
  });
  for (const endpoint of ['/redirect', '/large', '/error']) await assert.rejects(versionHttp(url + endpoint));
  assert.equal(redirected, false);
  await assert.rejects(versionHttp(url + '/version?token=synthetic'), /queries/);
});
test('collector CLI binds JUnit to artifact and source observation time', t => {
  const root = temporary(t), target = path.join(root, 'target.json'), artifact = path.join(root, 'artifact.json'), report = path.join(root, 'report.xml');
  const record = sample(); writeJson(target, record.scope.target); writeJson(artifact, record.scope.components[0].artifact); fs.writeFileSync(report, '<testsuite tests="1"><testcase/></testsuite>');
  const script = path.join(ROOT, 'skills/harness-verify-release/scripts/collect.mjs');
  const args = ['junit', '--component', 'api', '--attempt', '1', '--input', report, '--target', target, '--artifact', artifact, '--observed-at', '2026-01-01T12:00:00Z'];
  const result = JSON.parse(run(script, args).stdout); assert.equal(result.status, 'passed'); assert.equal(result.check, 'technical');
  assert.deepEqual(result.artifact, record.scope.components[0].artifact); assert.equal(result.observed_at, '2026-01-01T12:00:00Z');
  fs.writeFileSync(report, '<testsuite>'); assert.equal(JSON.parse(run(script, args, { code: 2 }).stdout).status, 'pending');
});
