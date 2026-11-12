import test from 'node:test';
import assert from 'node:assert/strict';
import { ecsVersion } from '../dist/collect.js';

const selection = { target: { environment: 'staging', identity: 'arn:aws:ecs:us-east-1:123456789012:service/greeting/api' }, account: '123456789012', region: 'us-east-1', cluster: 'arn:aws:ecs:us-east-1:123456789012:cluster/greeting', container: 'api' };
const taskArn = 'arn:aws:ecs:us-east-1:123456789012:task/greeting/abc';
const taskDefinition = 'arn:aws:ecs:us-east-1:123456789012:task-definition/api:1';
const digest = 'sha256:' + 'a'.repeat(64);
function fixture() {
  const data = {
    identity: { Account: selection.account, Arn: 'not-retained' },
    services: { services: [{ serviceArn: selection.target.identity, clusterArn: selection.cluster, status: 'ACTIVE', taskDefinition, desiredCount: 1, runningCount: 1, pendingCount: 0 }], failures: [] },
    list: { taskArns: [taskArn] },
    tasks: { tasks: [{ taskArn, clusterArn: selection.cluster, group: 'service:api', taskDefinitionArn: taskDefinition, desiredStatus: 'RUNNING', lastStatus: 'RUNNING', containers: [{ name: 'api', lastStatus: 'RUNNING', imageDigest: digest, environment: 'private-output' }] }], failures: [] }
  };
  const calls = [];
  const read = args => { calls.push(args); return structuredClone(args[0] === 'sts' ? data.identity : args[1] === 'describe-services' ? data.services : args[1] === 'list-tasks' ? data.list : data.tasks); };
  return { data, calls, read };
}
test('ECS observes a manifest across the bounded running service and performs only identity/list/describe reads', () => {
  const f = fixture(), result = ecsVersion(selection, f.read);
  assert.equal(result.status, 'passed'); assert.deepEqual(result.artifact, { kind: 'oci_manifest_digest', value: digest });
  assert.equal(f.calls.length, 6); assert.equal(f.calls[0][1], 'get-caller-identity');
  assert.ok(f.calls.every(args => ['get-caller-identity', 'describe-services', 'list-tasks', 'describe-tasks'].includes(args[1])));
  assert.ok(!JSON.stringify(result).includes('private-output')); assert.ok(!JSON.stringify(result).includes('not-retained'));
  assert.match(result.summary, /deployment execution and application behavior are separate/);
});
test('wrong account stops before service reads; invalid selections stop before any process', () => {
  const f = fixture(); f.data.identity.Account = '999999999999';
  assert.equal(ecsVersion(selection, f.read).status, 'failed'); assert.equal(f.calls.length, 1);
  assert.throws(() => ecsVersion({ ...selection, region: 'us-west-2' }, () => { throw new Error('Must not run'); }), /service ARN/);
  assert.throws(() => ecsVersion({ ...selection, profile: '--endpoint-url' }, () => { throw new Error('Must not run'); }), /profile/);
});
test('missing, partial, stopped, mixed, wrong service and changing task observations never produce an artifact pass', () => {
  const mutations = [
    f => { f.data.list.nextToken = 'more'; },
    f => { f.data.services.services[0].desiredCount = 0; },
    f => { f.data.tasks.tasks[0].lastStatus = 'STOPPED'; },
    f => { f.data.tasks.tasks[0].group = 'service:other'; },
    f => { delete f.data.tasks.tasks[0].containers[0].imageDigest; },
    f => { f.data.tasks.failures.push({ arn: taskArn, reason: 'private-error' }); },
    f => { f.data.tasks.tasks[0].taskDefinitionArn += '2'; },
    f => { const other = structuredClone(f.data.tasks.tasks[0]); other.taskArn += '2'; other.containers[0].imageDigest = 'sha256:' + 'b'.repeat(64); f.data.tasks.tasks.push(other); f.data.list.taskArns.push(other.taskArn); f.data.services.services[0].desiredCount = f.data.services.services[0].runningCount = 2; }
  ];
  for (const mutate of mutations) { const f = fixture(); mutate(f); const result = ecsVersion(selection, f.read); assert.equal(result.status, 'pending'); assert.equal(result.artifact, undefined); }
  const f = fixture(); let count = 0;
  const result = ecsVersion(selection, args => { const value = f.read(args); if (args[1] === 'list-tasks' && ++count === 2) value.taskArns = [taskArn + 'new']; return value; });
  assert.equal(result.status, 'pending'); assert.match(result.summary, /changed during collection/);
  assert.equal(ecsVersion(selection, () => { throw new Error('credential=private-error'); }).summary.includes('private-error'), false);
});
