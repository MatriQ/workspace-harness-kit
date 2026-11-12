import { spawnSync } from 'node:child_process';
import { isObject } from '../core/json.js';
import { planOnboarding } from '../core/onboarding.js';
import type { OnboardingQuestion, ToolDefinition } from '../core/onboarding.js';

export interface ProbeResult { status: number | null; stdout: string; stderr: string; error?: { code?: string; message?: string } }
export type ToolProbe = (tool: ToolDefinition) => ProbeResult;
export interface ToolInspection {
  id: string;
  status: 'manual' | 'missing' | 'unverified' | 'incompatible' | 'available';
  version: string | null;
  reason: string;
}
export interface ToolchainInspection {
  status: 'checked' | 'pending';
  tools: ToolInspection[];
  installation: 'not run';
  authentication: 'not run';
  target_access: 'not run';
  next_questions: OnboardingQuestion[];
}
const localProbe: ToolProbe = tool => {
  const result = spawnSync(tool.executable, [...tool.version_args], { encoding: 'utf8', timeout: 10000,
    maxBuffer: 256 * 1024, shell: false, env: { ...process.env, AWS_PAGER: '', CLOUDSDK_CORE_DISABLE_PROMPTS: '1',
      CLOUDSDK_COMPONENT_MANAGER_DISABLE_UPDATE_CHECK: 'true', GH_NO_UPDATE_NOTIFIER: '1', GH_PROMPT_DISABLED: '1' } });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error };
};
function parseVersion(id: string, result: ProbeResult): string | undefined {
  const output = result.stdout.trim();
  let value: unknown;
  if (['azure', 'gcloud', 'kubectl', 'terraform'].includes(id)) {
    try {
      const object: unknown = JSON.parse(output);
      if (!isObject(object)) return undefined;
      if (id === 'azure') value = object['azure-cli'];
      else if (id === 'gcloud') value = object['Google Cloud SDK'];
      else if (id === 'terraform') value = object.terraform_version;
      else if (isObject(object.clientVersion)) value = object.clientVersion.gitVersion;
    } catch { return undefined; }
  } else {
    // AWS CLI reports its version on stderr on some installations; do not persist either raw stream.
    const text = output || result.stderr.trim();
    const pattern = { aws: /^aws-cli\/([^\s]+)/, gh: /^gh version ([^\s]+)/,
      docker: /^Docker version ([^,\s]+)/, helm: /^(v?\d+\.\d+\.\d+(?:[-+][\w.-]+)?)/ }[id];
    value = pattern?.exec(text)?.[1];
  }
  return typeof value === 'string' && /^v?\d+(?:\.\d+){1,3}(?:[-+][a-zA-Z0-9.-]+)?$/.test(value) && !/[\r\n]/.test(value) ? value : undefined;
}
export function inspectToolchain(profile: unknown, probe: ToolProbe = localProbe): ToolchainInspection {
  const plan = planOnboarding(profile);
  const tools = plan.tools.map(requirement => {
    const definition = requirement.definition;
    if (!definition) return { id: requirement.id, status: 'manual' as const, version: null, reason: 'Use the vendor or project documentation; this tool has no maintained probe' };
    const result = probe(definition);
    if (result.error?.code === 'ENOENT') return { id: requirement.id, status: 'missing' as const, version: null, reason: 'Executable is not on PATH' };
    const version = parseVersion(definition.id, result);
    if (result.error || result.status !== 0 || !version) return { id: requirement.id, status: 'unverified' as const, version: null, reason: 'Version check did not produce a recognized successful result' };
    if (definition.minimum_major !== undefined && Number(version.replace(/^v/, '').split('.')[0]) < definition.minimum_major) return { id: requirement.id, status: 'incompatible' as const, version, reason: `Requires major version ${definition.minimum_major} or newer; reconcile project constraints before changing an existing installation` };
    return { id: requirement.id, status: 'available' as const, version, reason: 'Local version probe passed; check project-specific version constraints separately' };
  });
  return { status: plan.status === 'planned' && tools.every(tool => tool.status === 'available') ? 'checked' : 'pending',
    tools, installation: 'not run', authentication: 'not run', target_access: 'not run',
    next_questions: plan.questions };
}
