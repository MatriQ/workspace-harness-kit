import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { Artifact, ObservationStatus, Target } from '../core/types.js';
import { object, requireEvidence, validateArtifact, validateRefs, validateTarget } from '../core/evidence.js';
import { fullMatch, isObject } from '../core/json.js';
export { ecsVersion, validateEcsSelection } from './aws-ecs.js';
export type { EcsSelection, AwsReader } from './aws-ecs.js';

export function githubStep(job: unknown, stepName: string): { status: ObservationStatus; summary: string; evidence: string[] } {
  requireEvidence(isObject(job) && Array.isArray(job.steps), 'Expected a job with steps');
  const steps = job.steps.filter(step => isObject(step) && step.name === stepName);
  requireEvidence(steps.length === 1, 'Deployment step must resolve uniquely in the exported job');
  const step = steps[0], conclusion = step.conclusion;
  const statuses: Record<string, ObservationStatus> = { success: 'passed', failure: 'failed', timed_out: 'failed', cancelled: 'failed', skipped: 'not run' };
  const status = step.status === 'completed' && typeof conclusion === 'string' && Object.hasOwn(statuses, conclusion) ? statuses[conclusion] : 'pending';
  validateRefs([job.html_url]);
  requireEvidence(Number.isSafeInteger(job.id) && Number.isSafeInteger(job.run_id) && Number.isSafeInteger(step.number), 'Job, run and step identifiers must be integers');
  return { status, summary: `Job ${job.id}, run ${job.run_id}, step ${step.number}: ${conclusion || 'incomplete'}`, evidence: [job.html_url as string] };
}
export async function versionHttp(url: string): Promise<{ status: 'passed'; target: Target; artifact: Artifact; summary: string; evidence: string[] }> {
  validateRefs([url]);
  requireEvidence(['http:', 'https:'].includes(new URL(url).protocol), 'Version probes require an HTTP(S) URL');
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
  const reader = response.body?.getReader();
  try {
    requireEvidence(response.ok, `Version endpoint returned HTTP ${response.status}`);
    requireEvidence(reader, 'Version response is empty');
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      requireEvidence(bytes <= 65536, 'Version response exceeds 64 KiB');
      chunks.push(value);
    }
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
    object(value, 'version response', ['target', 'artifact']);
    validateTarget(value.target); validateArtifact(value.artifact);
    return { status: 'passed', target: value.target, artifact: value.artifact,
      summary: "Read the target's declared artifact identity", evidence: [url] };
  } finally { await reader?.cancel().catch(() => {}); }
}
interface XmlNode { tag: string; attributes: Record<string, string>; children: XmlNode[] }
export function junit(data: string): { status: ObservationStatus; summary: string } {
  requireEvidence(!/<!DOCTYPE|<!ENTITY/i.test(data), 'JUnit input must not declare XML entities');
  requireEvidence(XMLValidator.validate(data) === true, 'Malformed JUnit XML');
  const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false, removeNSPrefix: true,
    parseTagValue: false, parseAttributeValue: false, processEntities: false, ignoreDeclaration: true });
  function nodes(values: unknown): XmlNode[] {
    requireEvidence(Array.isArray(values), 'Invalid JUnit XML tree');
    return values.flatMap((item: unknown) => {
      requireEvidence(isObject(item), 'Invalid JUnit XML node');
      return Object.entries(item).filter(([key]) => key !== ':@' && !key.startsWith('#') && !key.startsWith('?')).map(([tag, children]) => ({
        tag, attributes: (item[':@'] ?? {}) as Record<string, string>, children: nodes(children),
      }));
    });
  }
  const roots = nodes(parser.parse(data) as unknown);
  requireEvidence(roots.length === 1 && ['testsuite', 'testsuites'].includes(roots[0].tag), 'Expected a JUnit testsuite or testsuites document');
  const descendants = (node: XmlNode): XmlNode[] => [node, ...node.children.flatMap(descendants)];
  const all = descendants(roots[0]), cases = all.filter(node => node.tag === 'testcase');
  const failed = cases.filter(node => node.children.some(child => ['failure', 'error'].includes(child.tag))).length;
  const skipped = cases.filter(node => node.children.some(child => child.tag === 'skipped')).length;
  let incomplete = false, declaredFailure = false, declaredSkip = false;
  for (const suite of all.filter(node => ['testsuite', 'testsuites'].includes(node.tag))) {
    for (const field of ['tests', 'failures', 'errors', 'skipped']) {
      const count = suite.attributes['@_' + field];
      if (count !== undefined) requireEvidence(fullMatch(/^\d+$/, count) && Number.isSafeInteger(Number(count)), `Invalid JUnit ${field} count`);
    }
    if (Number(suite.attributes['@_failures'] ?? 0) || Number(suite.attributes['@_errors'] ?? 0)) declaredFailure = true;
    if (Number(suite.attributes['@_skipped'] ?? 0)) declaredSkip = true;
    if ('@_tests' in suite.attributes) incomplete ||= Number(suite.attributes['@_tests']) !== descendants(suite).filter(node => node.tag === 'testcase').length;
  }
  const status = failed || declaredFailure ? 'failed' : incomplete || skipped || declaredSkip ? 'pending' : cases.length ? 'passed' : 'not run';
  const flag = (value: boolean) => value ? 'True' : 'False';
  return { status, summary: `JUnit: ${cases.length} observed cases, ${failed} failing, ${skipped} skipped; declared failures/errors: ${flag(declaredFailure)}; declared skips: ${flag(declaredSkip)}; incomplete counts: ${flag(incomplete)}` };
}
