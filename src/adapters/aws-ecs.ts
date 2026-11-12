import { spawnSync } from 'node:child_process';
import { object, requireEvidence, validateArtifact, validateTarget } from '../core/evidence.js';
import { equal, fullMatch, isObject, json } from '../core/json.js';
import type { Artifact, ObservationStatus, Target } from '../core/types.js';
import { hash } from './files.js';

export interface EcsSelection { target: Target; account: string; region: string; cluster: string; container: string; profile?: string }
export type AwsReader = (args: string[]) => unknown;
const awsRead: AwsReader = args => {
  const execution = spawnSync('aws', args, { encoding: 'utf8', shell: false, timeout: 10000, maxBuffer: 1024 * 1024,
    env: { ...process.env, AWS_PAGER: '', AWS_CLI_AUTO_PROMPT: 'off', AWS_IGNORE_CONFIGURED_ENDPOINT_URLS: 'true' } });
  // AWS error streams can contain credentials, endpoint details or raw task data. Keep them local.
  requireEvidence(!execution.error && execution.status === 0, 'AWS read did not complete successfully; inspect access locally');
  try { return JSON.parse(execution.stdout) as unknown; } catch { throw new Error('AWS read did not return valid JSON'); }
};
export function validateEcsSelection(value: unknown): asserts value is EcsSelection {
  object(value, 'ECS selection', ['target', 'account', 'region', 'cluster', 'container'], ['profile']); validateTarget(value.target);
  requireEvidence(typeof value.account === 'string' && fullMatch(/^\d{12}$/, value.account), 'Expected a 12-digit AWS account');
  requireEvidence(typeof value.region === 'string' && fullMatch(/^[a-z]{2}(?:-[a-z]+)+-\d+$/, value.region), 'Expected an explicit AWS region');
  const service = /^arn:(aws(?:-[a-z-]+)?):ecs:([^:]+):(\d{12}):service\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)$/.exec(value.target.identity);
  requireEvidence(service && service[0] === value.target.identity && service[2] === value.region && service[3] === value.account, 'Target identity must be the long service ARN in the selected account and region');
  requireEvidence(value.cluster === `arn:${service[1]}:ecs:${value.region}:${value.account}:cluster/${service[4]}`, 'Cluster must match the service ARN');
  requireEvidence(typeof value.container === 'string' && fullMatch(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, value.container), 'Select a literal container name');
  if ('profile' in value) requireEvidence(typeof value.profile === 'string' && fullMatch(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/, value.profile), 'Select a literal AWS profile name');
}
export function ecsVersion(selection: unknown, read: AwsReader = awsRead): { status: ObservationStatus; target: Target; artifact?: Artifact; summary: string; evidence: string[] } {
  validateEcsSelection(selection);
  const { target, account, region, cluster, container, profile } = selection;
  const refs: string[] = [`aws-ecs:${target.identity}`];
  const result = (status: ObservationStatus, summary: string, artifact?: Artifact) => ({ status, target, ...(artifact ? { artifact } : {}), summary, evidence: refs });
  const call = (args: string[]): Record<string, unknown> => {
    const value = read([...args, '--region', region, '--output', 'json', '--no-cli-pager', '--no-cli-auto-prompt', '--cli-connect-timeout', '5', '--cli-read-timeout', '5', ...(profile ? ['--profile', profile] : [])]);
    requireEvidence(isObject(value), 'Incomplete AWS response'); return value;
  };
  try {
    const identity = call(['sts', 'get-caller-identity']);
    if (identity.Account !== account) return result('failed', 'Caller account differs from the selected AWS account; ECS reads were not attempted');
    const serviceArgs = ['ecs', 'describe-services', '--cluster', cluster, '--services', target.identity];
    const listArgs = ['ecs', 'list-tasks', '--cluster', cluster, '--service-name', target.identity.split('/').at(-1)!, '--desired-status', 'RUNNING', '--no-paginate'];
    const serviceFrom = (response: Record<string, unknown>) => {
      requireEvidence(Array.isArray(response.services) && response.services.length === 1 && (response.failures === undefined || (Array.isArray(response.failures) && !response.failures.length)), 'Service observation is incomplete');
      const service = response.services[0]; requireEvidence(isObject(service) && service.serviceArn === target.identity && service.clusterArn === cluster, 'Service observation differs from the selected target'); return service;
    };
    const service = serviceFrom(call(serviceArgs));
    requireEvidence(typeof service.taskDefinition === 'string' && service.taskDefinition.startsWith(cluster.split(':cluster/')[0] + ':task-definition/'), 'Missing service task definition');
    if (service.status !== 'ACTIVE' || !Number.isSafeInteger(service.desiredCount) || Number(service.desiredCount) <= 0 || service.runningCount !== service.desiredCount || service.pendingCount !== 0) return result('pending', 'Service is scaled to zero, unavailable or still converging');
    const taskArns = (response: Record<string, unknown>): string[] => {
      requireEvidence(!response.nextToken && !response.NextToken && Array.isArray(response.taskArns) && response.taskArns.length > 0 && response.taskArns.length <= 100, 'Task selection is empty, paginated or exceeds the bounded 100-task collector');
      requireEvidence(response.taskArns.every(arn => typeof arn === 'string' && arn.startsWith(cluster.replace(':cluster/', ':task/') + '/') && /^[A-Za-z0-9:/_-]+$/.test(arn)), 'Task identity is outside the selected cluster');
      requireEvidence(new Set(response.taskArns).size === response.taskArns.length, 'Repeated task identity'); return response.taskArns as string[];
    };
    const selected = taskArns(call(listArgs));
    if (selected.length !== service.runningCount) return result('pending', 'Task membership and service counts differ');
    const tasks = call(['ecs', 'describe-tasks', '--cluster', cluster, '--tasks', ...selected]);
    requireEvidence(Array.isArray(tasks.tasks) && tasks.tasks.length === selected.length && (tasks.failures === undefined || (Array.isArray(tasks.failures) && !tasks.failures.length)), 'Task observations are incomplete');
    const digests = new Set<string>(), seen = new Set<string>();
    for (const task of tasks.tasks) {
      requireEvidence(isObject(task) && typeof task.taskArn === 'string' && selected.includes(task.taskArn) && !seen.has(task.taskArn), 'Unexpected or repeated task'); seen.add(task.taskArn);
      if (task.clusterArn !== cluster || task.group !== `service:${target.identity.split('/').at(-1)}` || task.taskDefinitionArn !== service.taskDefinition || task.lastStatus !== 'RUNNING' || task.desiredStatus !== 'RUNNING') return result('pending', 'Tasks do not establish a single running service revision');
      requireEvidence(Array.isArray(task.containers), 'Missing task containers');
      const containers = task.containers.filter(item => isObject(item) && item.name === container);
      requireEvidence(containers.length === 1 && isObject(containers[0]), 'Requested container was not found uniquely');
      const observed = containers[0];
      if (observed.lastStatus !== 'RUNNING') return result('pending', 'Requested container is not running');
      const artifact = { kind: 'oci_manifest_digest', value: observed.imageDigest }; validateArtifact(artifact); digests.add(artifact.value);
    }
    if (digests.size !== 1) return result('pending', 'Running tasks have mixed image manifests; no single artifact can be reported');
    const after = serviceFrom(call(serviceArgs)), afterTasks = taskArns(call(listArgs));
    const serviceState = (value: Record<string, unknown>) => [value.serviceArn, value.clusterArn, value.taskDefinition, value.status, value.desiredCount, value.runningCount, value.pendingCount, value.deployments];
    if (!equal(serviceState(service), serviceState(after)) || !equal([...selected].sort(), [...afterTasks].sort())) return result('pending', 'Service or task membership changed during collection');
    refs.push(`aws-ecs:snapshot-sha256:${hash(json({ service: serviceState(service), tasks: [...seen].sort(), digests: [...digests] }))}`);
    return result('passed', `Observed one container manifest across ${selected.length} running tasks; deployment execution and application behavior are separate checks`, { kind: 'oci_manifest_digest', value: [...digests][0] });
  } catch { return result('pending', 'AWS reads or target observations were incomplete; inspect access and service state locally'); }
}
