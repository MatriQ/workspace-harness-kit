import { fullMatch, isObject } from './json.js';
import { HARNESS_PARTS, validateHarnessSelection } from './harness.js';
import type { HarnessSelection } from './harness.js';

export const ACTIVITIES = ['development', 'testing', 'deployment', 'operations'] as const;
export type Activity = typeof ACTIVITIES[number];
export type Provider = 'aws' | 'azure' | 'gcp' | 'other';
export type ToolPolicy = 'install-missing' | 'inspect-only';
export interface ExistingDocumentChoice { member: string; path: string; action: 'keep' | 'move'; destination?: string }
export interface PlatformProfile {
  id: string;
  provider: Provider;
  name?: string;
  services?: string[];
  environments?: string[];
  access?: 'cli' | 'existing-tools' | 'documentation-only';
  delivery?: 'github-actions' | 'azure-pipelines' | 'gitlab-ci' | 'manual' | 'other';
  tools?: string[];
}
export interface OnboardingProfile {
  schema_version: 1;
  language?: 'en' | 'zh-CN';
  background?: string;
  activities?: Partial<Record<Activity, boolean>>;
  platforms?: PlatformProfile[];
  tool_policy?: ToolPolicy;
  documentation?: { placement: 'coordinator' | 'members'; root: string; entrypoint?: string; existing_documents?: ExistingDocumentChoice[] };
  harness?: HarnessSelection;
}
export class OnboardingError extends Error { override name = 'OnboardingError'; }
function requireProfile(condition: unknown, message: string): asserts condition { if (!condition) throw new OnboardingError(message); }
function shape(value: unknown, name: string, fields: string[]): asserts value is Record<string, unknown> {
  requireProfile(isObject(value), `${name} must be an object`);
  requireProfile(Object.keys(value).every(key => fields.includes(key)), `${name} has unknown fields`);
}
function nonempty(value: unknown, name: string): asserts value is string {
  requireProfile(typeof value === 'string' && value.trim() && value.length <= 2000, `${name} must be nonempty text of at most 2000 characters`);
}
function names(value: unknown, name: string): asserts value is string[] {
  requireProfile(Array.isArray(value), `${name} must be a list`);
  for (const item of value) nonempty(item, name);
  requireProfile(new Set(value).size === value.length, `${name} contains duplicates`);
}
function relative(value: unknown): void {
  requireProfile(typeof value === 'string' && !/[\\:\x00-\x1f\x7f]/.test(value)
    && value.split('/').every(part => part && !['.', '..', '.git', 'node_modules'].includes(part)), 'Documentation paths must be normalized relative paths outside Git metadata and dependencies');
}
export function validateOnboarding(value: unknown): asserts value is OnboardingProfile {
  shape(value, 'onboarding', ['schema_version', 'language', 'background', 'activities', 'platforms', 'tool_policy', 'documentation', 'harness']);
  requireProfile(value.schema_version === 1, 'Expected onboarding schema_version 1');
  if ('language' in value) requireProfile(value.language === 'en' || value.language === 'zh-CN', 'Choose en or zh-CN for generated harness prose');
  if ('harness' in value) validateHarnessSelection(value.harness);
  if ('background' in value) nonempty(value.background, 'background');
  if ('activities' in value) {
    shape(value.activities, 'activities', [...ACTIVITIES]);
    requireProfile(Object.values(value.activities).every(item => typeof item === 'boolean'), 'Activity choices must be booleans; omit unanswered choices');
  }
  if ('tool_policy' in value) requireProfile(['install-missing', 'inspect-only'].includes(value.tool_policy as string), 'Unknown tool_policy');
  if ('documentation' in value) {
    shape(value.documentation, 'documentation', ['placement', 'root', 'entrypoint', 'existing_documents']);
    requireProfile(['coordinator', 'members'].includes(value.documentation.placement as string), 'Choose coordinator or members documentation placement');
    relative(value.documentation.root);
    if ('entrypoint' in value.documentation) relative(value.documentation.entrypoint);
    if ('existing_documents' in value.documentation) {
      requireProfile(Array.isArray(value.documentation.existing_documents), 'existing_documents must be a list of explicit choices');
      const seen = new Set<string>(), destinations = new Set<string>();
      for (const choice of value.documentation.existing_documents) {
        shape(choice, 'existing document choice', ['member', 'path', 'action', 'destination']);
        requireProfile(typeof choice.member === 'string' && fullMatch(/^[a-z0-9][a-z0-9._-]*$/, choice.member), 'Existing documents need a stable member ID');
        relative(choice.path);
        const key = JSON.stringify([choice.member, choice.path]);
        requireProfile(!seen.has(key), 'Repeated existing document choice'); seen.add(key);
        requireProfile(choice.action === 'keep' || choice.action === 'move', 'Choose keep or move for each existing document');
        if (choice.action === 'move') {
          relative(choice.destination);
          requireProfile((choice.destination as string).startsWith(`${value.documentation.root}/`) && choice.destination !== choice.path, 'Move destinations must be inside the documentation root and differ from the source');
          const destination = JSON.stringify([choice.member, choice.destination]);
          requireProfile(!destinations.has(destination), 'Multiple documents cannot move to the same destination'); destinations.add(destination);
        } else requireProfile(!('destination' in choice), 'Kept documents do not have a move destination');
      }
    }
  }
  if ('platforms' in value) {
    requireProfile(Array.isArray(value.platforms), 'platforms must be a list');
    const seen = new Set<string>();
    for (const platform of value.platforms) {
      shape(platform, 'platform', ['id', 'provider', 'name', 'services', 'environments', 'access', 'delivery', 'tools']);
      requireProfile(typeof platform.id === 'string' && fullMatch(/^[a-z0-9][a-z0-9._-]*$/, platform.id) && !seen.has(platform.id), 'Platform IDs must be unique lowercase identifiers');
      seen.add(platform.id);
      requireProfile(['aws', 'azure', 'gcp', 'other'].includes(platform.provider as string), 'Unknown provider; use other with its actual name');
      if ('name' in platform) nonempty(platform.name, 'platform.name');
      if (platform.provider === 'other') nonempty(platform.name, 'platform.name');
      for (const field of ['services', 'environments', 'tools']) if (field in platform) names(platform[field], `platform.${field}`);
      if ('access' in platform) requireProfile(['cli', 'existing-tools', 'documentation-only'].includes(platform.access as string), 'Unknown platform access mode');
      if ('delivery' in platform) requireProfile(['github-actions', 'azure-pipelines', 'gitlab-ci', 'manual', 'other'].includes(platform.delivery as string), 'Unknown delivery method; use other for a project-owned workflow');
    }
  }
}
export interface ToolDefinition {
  id: string;
  executable: string;
  version_args: readonly string[];
  install_url: string;
  minimum_major?: number;
}
/** Executables and arguments are maintained here, never taken from an untrusted profile. */
export const TOOL_CATALOG: readonly ToolDefinition[] = [
  { id: 'aws', executable: 'aws', version_args: ['--version'], minimum_major: 2, install_url: 'https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html' },
  { id: 'azure', executable: 'az', version_args: ['version', '--output', 'json'], minimum_major: 2, install_url: 'https://learn.microsoft.com/en-us/cli/azure/install-azure-cli' },
  { id: 'gcloud', executable: 'gcloud', version_args: ['version', '--format=json'], install_url: 'https://docs.cloud.google.com/sdk/docs/install-sdk' },
  { id: 'gh', executable: 'gh', version_args: ['--version'], install_url: 'https://github.com/cli/cli#installation' },
  { id: 'kubectl', executable: 'kubectl', version_args: ['version', '--client=true', '--output=json'], install_url: 'https://kubernetes.io/docs/tasks/tools/' },
  { id: 'helm', executable: 'helm', version_args: ['version', '--short'], install_url: 'https://helm.sh/docs/intro/install/' },
  { id: 'terraform', executable: 'terraform', version_args: ['version', '-json'], install_url: 'https://developer.hashicorp.com/terraform/install' },
  { id: 'docker', executable: 'docker', version_args: ['--version'], install_url: 'https://docs.docker.com/get-started/get-docker/' },
];
export interface OnboardingQuestion { id: string; prompt: string; choices?: string[] }
export interface ToolRequirement { id: string; reasons: string[]; definition: ToolDefinition | null }
export interface DocumentRequirement { scope: 'workspace' | 'selected-members'; path: string; topic: string }
export interface OnboardingPlan {
  status: 'needs-input' | 'planned';
  language: 'en' | 'zh-CN' | 'undecided';
  questions: OnboardingQuestion[];
  tools: ToolRequirement[];
  tool_policy: ToolPolicy | 'undecided';
  documents: DocumentRequirement[];
  platform_guides: Array<{ platform: string; reference: string }>;
  harness?: { layout: 'centralized' | 'native'; targets: string[]; artifacts: string[]; reference: string; activation: 'not run' };
  execution: { installation: 'not run'; authentication: 'not run'; target_access: 'not run'; documentation: 'not run' };
}
/** Plans only the requested activities. Missing answers remain missing, rather than becoming defaults. */
export function planOnboarding(input: unknown): OnboardingPlan {
  validateOnboarding(input);
  const profile = input, activities = profile.activities ?? {}, platforms = profile.platforms ?? [];
  const remote = activities.deployment === true || activities.operations === true;
  const questions: OnboardingQuestion[] = [];
  if (!profile.language) questions.push({ id: 'language', prompt: 'Which language should the generated harness documents and agent instructions use?', choices: ['English (en)', '简体中文 (zh-CN)'] });
  if (!profile.background) questions.push({ id: 'background',
    prompt: 'What role should this workspace serve? In an empty directory, choose its role before describing an application; an existing project can supply background from its sources.',
    choices: ['Harness documentation hub — keep shared harness guides here and connect other repositories by Git URL or local directory',
      'Monorepo — initialize the harness here and add application code to this repository later',
      'Existing or other project — use confirmed project context or describe another setup'] });
  const unanswered = ACTIVITIES.filter(activity => activities[activity] === undefined);
  if (unanswered.length) questions.push({ id: 'activities', prompt: `Which of these activities should initialization cover: ${unanswered.join(', ')}? Record each as needed or not needed.` });
  if (remote && !platforms.length) questions.push({ id: 'platforms', prompt: 'Which platforms host the environments you want to deploy to or operate? Multiple platforms are supported.', choices: ['AWS', 'Azure', 'Google Cloud', 'Other / self-hosted'] });
  if (remote) for (const platform of platforms) {
    if (!platform.services?.length || !platform.environments?.length) questions.push({ id: `${platform.id}.targets`, prompt: `For ${platform.name ?? platform.provider}, which services and environments are in scope? Reuse confirmed repository configuration where possible.` });
    if (platform.access === undefined) questions.push({ id: `${platform.id}.access`, prompt: `How should the harness access ${platform.id}?`, choices: ['Provider CLI', 'Existing tools or connector', 'Documentation only'] });
    if (activities.deployment && platform.delivery === undefined) questions.push({ id: `${platform.id}.delivery`, prompt: `How are releases to ${platform.id} performed?`, choices: ['GitHub Actions', 'Azure Pipelines', 'GitLab CI', 'Manual procedure', 'Other'] });
    if (platform.provider === 'other' && platform.access === 'cli' && !platform.tools?.length) questions.push({ id: `${platform.id}.tools`, prompt: `Which vendor CLI or project-owned tools are needed for ${platform.name}? Supply their official installation documentation during setup.` });
  }
  const preparesTools = activities.development || activities.testing || (remote && platforms.some(platform => platform.access === 'cli'));
  if (preparesTools && !profile.tool_policy) questions.push({ id: 'tool_policy', prompt: 'Should setup install missing tools, or only inspect and document prerequisites?', choices: ['Install missing tools', 'Inspect only'] });
  if (profile.harness) {
    if (!profile.harness.targets?.length) questions.push({ id: 'harness.targets', prompt: 'Which local agents should load the generated harness?', choices: ['Codex', 'Claude Code', 'Both'] });
    const missing = HARNESS_PARTS.filter(part => profile.harness!.artifacts?.[part] === undefined);
    if (missing.length) questions.push({ id: 'harness.artifacts', prompt: `Which harness parts should be generated or refreshed: ${missing.join(', ')}? Reuse existing components where suitable.` });
  }
  const requirements = new Map<string, string[]>();
  const addTool = (id: string, reason: string) => requirements.set(id, [...new Set([...(requirements.get(id) ?? []), reason])]);
  if (remote) for (const platform of platforms) if (platform.access === 'cli') {
    if (platform.provider !== 'other') addTool({ aws: 'aws', azure: 'azure', gcp: 'gcloud' }[platform.provider], `${platform.id}: provider access`);
    if (activities.deployment && platform.delivery === 'github-actions') addTool('gh', `${platform.id}: release workflow inspection`);
    if (activities.deployment && platform.delivery === 'azure-pipelines') addTool('azure', `${platform.id}: pipeline access; verify the Azure DevOps extension separately`);
    for (const tool of platform.tools ?? []) addTool(tool, `${platform.id}: explicitly selected tool`);
  }
  const scope = profile.documentation?.placement === 'members' ? 'selected-members' : 'workspace';
  const root = profile.documentation?.root ?? (profile.harness?.layout === 'centralized' ? '.harness/docs' : 'docs/harness');
  const documents: DocumentRequirement[] = [{ scope, path: `${root}/index.md`, topic: 'Background, selected repositories, requested activities, task routing, sources and unresolved decisions' }];
  if (activities.development) documents.push({ scope, path: `${root}/development.md`, topic: 'Project runtimes, installation, configuration, startup and a representative local smoke check' });
  if (activities.testing) documents.push({ scope, path: `${root}/testing.md`, topic: 'Native test entry points, scope, fixtures, CI gates and report locations' });
  if (remote) documents.push({ scope, path: `${root}/environments.md`, topic: 'Per-platform environment identity, services, regions, access method and evidence sources' });
  if (activities.deployment) documents.push({ scope, path: `${root}/release.md`, topic: 'Release trigger, artifact, ordering, authorization, runtime verification and rollback' });
  if (activities.operations) documents.push({ scope, path: `${root}/operations.md`, topic: 'Logs, metrics, alerts, queues, dependencies, investigation steps and escalation' });
  if (ACTIVITIES.some(activity => activities[activity])) documents.push({ scope, path: `${root}/toolchain.md`, topic: 'Selected tools, authoritative installation methods, version constraints and access verification procedures' });
  if (profile.documentation?.entrypoint) documents.push({ scope, path: profile.documentation.entrypoint, topic: 'Short task router linking existing and generated authoritative guides' });
  return {
    status: questions.length ? 'needs-input' : 'planned', language: profile.language ?? 'undecided', questions,
    tools: [...requirements].map(([id, reasons]) => {
      const definition = TOOL_CATALOG.find(tool => tool.id === id);
      return { id, reasons, definition: definition ? structuredClone(definition) : null };
    }),
    tool_policy: profile.tool_policy ?? 'undecided', documents,
    platform_guides: remote ? platforms.map(platform => ({ platform: platform.id, reference: `references/providers/${platform.provider}.md` })) : [],
    ...(profile.harness ? { harness: { layout: profile.harness.layout ?? 'native', targets: [...(profile.harness.targets ?? [])], artifacts: HARNESS_PARTS.filter(part => profile.harness!.artifacts?.[part]), reference: 'references/generation.md', activation: 'not run' as const } } : {}),
    execution: { installation: 'not run', authentication: 'not run', target_access: 'not run', documentation: 'not run' },
  };
}
