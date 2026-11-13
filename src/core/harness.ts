import { DEFAULT_LOCAL_CONTEXT, isLocalResource } from './local-context.js';
import { fullMatch, isObject, json } from './json.js';
import { validateDiagnosticSpec } from './verification.js';
import type { DiagnosticSpec } from './verification.js';
import { DOCUMENT_TOPICS } from './documentation.js';
import type { DocumentCoverage } from './documentation.js';

export const HARNESS_TARGETS = ['codex', 'claude-code'] as const;
export const HARNESS_PARTS = ['documents', 'skills', 'commands', 'agents', 'rules', 'settings', 'hooks', 'ci'] as const;
export type HarnessTarget = typeof HARNESS_TARGETS[number];
export type HarnessPart = typeof HARNESS_PARTS[number];
export type HarnessLayout = 'centralized' | 'native';
export interface HarnessSelection { layout?: HarnessLayout; targets?: HarnessTarget[]; artifacts?: Partial<Record<HarnessPart, boolean>> }
export interface TextResource { path: string; body: string; executable?: boolean }
export interface HarnessProcedure { name: string; description: string; body: string; resources?: TextResource[] }
export interface HarnessRule { name: string; body: string }
export interface CommandPolicy { prefix: string[]; decision: 'ask' | 'deny'; reason: string }
export interface CommandGuard { id: string; contains_all: string[]; reason: string }
export interface HookCase { name: string; input: Record<string, unknown>; expected: 'pass' | 'deny' }
export interface HarnessSource { member?: string; path: string }
export interface HarnessSpec {
  schema_version: 1;
  name: string;
  language?: 'en' | 'zh-CN';
  layout?: HarnessLayout;
  documentation_root?: string;
  targets: HarnessTarget[];
  sources: HarnessSource[];
  command_checks?: Array<{ document: string; command: string; member?: string; cwd?: string; phase?: 'current' | 'planned'; reason?: string }>;
  document_coverage?: DocumentCoverage[];
  provenance?: Array<{ output: string; sources: HarnessSource[] }>;
  projections?: Array<{ source: HarnessSource; target: HarnessSource }>;
  verification?: DiagnosticSpec;
  documents?: TextResource[];
  skills?: HarnessProcedure[];
  commands?: HarnessProcedure[];
  agents?: HarnessProcedure[];
  rules?: HarnessRule[];
  resources?: TextResource[];
  settings?: {
    commands?: CommandPolicy[];
    codex?: { sandbox_mode: 'read-only' | 'workspace-write'; approval_policy: 'on-request' | 'never' };
    claude_code?: { defaultMode: 'default' | 'plan' | 'dontAsk' };
  };
  hooks?: { guards: CommandGuard[]; cases: HookCase[] };
  ci?: { provider: 'github-actions'; checks: Array<{ name: string; run: string; working_directory?: string }> };
}
export class HarnessError extends Error { override name = 'HarnessError'; }
export function requireHarness(condition: unknown, message: string): asserts condition { if (!condition) throw new HarnessError(message); }
function shape(value: unknown, name: string, fields: string[]): asserts value is Record<string, unknown> {
  requireHarness(isObject(value), `${name} must be an object`);
  requireHarness(Object.keys(value).every(key => fields.includes(key)), `${name} has unknown fields`);
}
function text(value: unknown, name: string): asserts value is string {
  requireHarness(typeof value === 'string' && value.trim() && value.length <= 100000 && !value.includes('\0'), `${name} must be nonempty text (at most 100000 characters)`);
}
function identifier(value: unknown): asserts value is string {
  requireHarness(typeof value === 'string' && value.length <= 64 && fullMatch(/^[a-z][a-z0-9-]*$/, value), 'Names must be lowercase hyphenated identifiers of at most 64 characters');
}
export function harnessPath(value: unknown): asserts value is string {
  requireHarness(typeof value === 'string' && !/[\\:\x00-\x1f\x7f]/.test(value) && value.split('/').every(part => part && part !== '.' && part !== '..'), 'Expected a normalized relative harness path');
  requireHarness(!isLocalResource(value), 'Local context cannot be a shared artifact or source');
  requireHarness(!value.split('/').some(part => ['.git', 'node_modules'].includes(part)), 'Harness paths cannot address Git metadata or dependencies');
}
function list(value: unknown, name: string): asserts value is unknown[] { requireHarness(Array.isArray(value), `${name} must be a list`); }
function unique(values: unknown[], name: string): void { requireHarness(new Set(values).size === values.length, `${name} contains duplicates`); }
function targets(value: unknown): asserts value is HarnessTarget[] {
  list(value, 'targets'); requireHarness(value.length && value.every(item => HARNESS_TARGETS.includes(item as HarnessTarget)), 'Select codex, claude-code, or both'); unique(value, 'targets');
}
export function validateHarnessSelection(value: unknown): asserts value is HarnessSelection {
  shape(value, 'harness', ['layout', 'targets', 'artifacts']);
  if ('layout' in value) requireHarness(value.layout === 'centralized' || value.layout === 'native', 'Choose centralized or native harness layout');
  if ('targets' in value) targets(value.targets);
  if ('artifacts' in value) {
    shape(value.artifacts, 'harness.artifacts', [...HARNESS_PARTS]);
    requireHarness(Object.values(value.artifacts).every(item => typeof item === 'boolean'), 'Artifact choices must be booleans; omit unanswered choices');
    if (value.layout === 'centralized') requireHarness(!['settings', 'hooks'].some(part => (value.artifacts as Record<string, unknown>)[part] === true), 'Centralized layout does not register native settings or hooks; choose native layout for those integrations');
  }
}
function resources(value: unknown): asserts value is TextResource[] {
  list(value, 'resources');
  for (const item of value) {
    shape(item, 'resource', ['path', 'body', 'executable']); harnessPath(item.path); text(item.body, 'resource.body');
    if ('executable' in item) requireHarness(typeof item.executable === 'boolean', 'executable must be boolean');
  }
  unique(value.map(item => (item as TextResource).path), 'resource paths');
}
export function validateHarnessSpec(value: unknown): asserts value is HarnessSpec {
  shape(value, 'harness spec', ['schema_version', 'name', 'language', 'layout', 'documentation_root', 'targets', 'sources', ...HARNESS_PARTS, 'resources', 'command_checks', 'document_coverage', 'provenance', 'projections', 'verification']);
  requireHarness(value.schema_version === 1, 'Expected harness schema_version 1'); text(value.name, 'name'); targets(value.targets);
  if ('language' in value) requireHarness(value.language === 'en' || value.language === 'zh-CN', 'Generated entry-point language must be en or zh-CN');
  if ('layout' in value) requireHarness(value.layout === 'centralized' || value.layout === 'native', 'Choose centralized or native harness layout');
  if ('documentation_root' in value) {
    harnessPath(value.documentation_root);
    requireHarness(value.documentation_root !== '.harness', 'Documentation cannot use the harness state root');
    if (value.layout === 'centralized') requireHarness(value.documentation_root === '.harness/docs' || value.documentation_root.startsWith('.harness/docs/'), 'Centralized documentation_root must be .harness/docs or a subdirectory');
    else requireHarness(!value.documentation_root.startsWith('.harness/') || value.documentation_root === '.harness/docs' || value.documentation_root.startsWith('.harness/docs/'), 'Documentation cannot use reserved harness state directories');
  }
  if (value.layout === 'centralized') requireHarness(!['settings', 'hooks'].some(part => part in value), 'Centralized layout does not register native settings or hooks; choose native layout for those integrations');
  list(value.sources, 'sources');
  for (const source of value.sources) {
    shape(source, 'source', ['member', 'path']); harnessPath(source.path);
    if ('member' in source) { text(source.member, 'source.member'); requireHarness(fullMatch(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, source.member), 'Invalid source member'); }
  }
  unique(value.sources.map(source => json(source)), 'sources');
  if ('verification' in value) validateDiagnosticSpec(value.verification, harnessPath);
  const sourceRef = (source: unknown) => {
    shape(source, 'source reference', ['member', 'path']); harnessPath(source.path);
    if ('member' in source) requireHarness(typeof source.member === 'string' && fullMatch(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, source.member), 'Invalid member reference');
  };
  if ('command_checks' in value) {
    list(value.command_checks, 'command_checks');
    for (const check of value.command_checks) {
      shape(check, 'command check', ['document', 'command', 'member', 'cwd', 'phase', 'reason']); harnessPath(check.document); text(check.command, 'command');
      if ('cwd' in check) harnessPath(check.cwd);
      if ('member' in check) sourceRef({ member: check.member, path: 'context' });
      if ('phase' in check) requireHarness(['current', 'planned'].includes(String(check.phase)), 'Command phase must be current or planned');
      if ('reason' in check) text(check.reason, 'command reason');
      if (check.phase === 'planned') text(check.reason, 'Planned commands require a reason');
    }
    unique(value.command_checks.map(check => { const item = check as { document: string; command: string }; return json([item.document, item.command]); }), 'command contexts');
  }
  if ('document_coverage' in value) {
    list(value.document_coverage, 'document_coverage');
    for (const entry of value.document_coverage) {
      shape(entry, 'document coverage', ['topic', 'path', 'heading']);
      requireHarness(DOCUMENT_TOPICS.includes(entry.topic as DocumentCoverage['topic']), 'Unknown documentation topic'); harnessPath(entry.path);
      if ('heading' in entry) text(entry.heading, 'coverage heading');
    }
    unique(value.document_coverage.map(entry => (entry as DocumentCoverage).topic), 'document coverage topics');
  }
  if ('provenance' in value) {
    list(value.provenance, 'provenance');
    for (const entry of value.provenance) {
      shape(entry, 'provenance entry', ['output', 'sources']); harnessPath(entry.output); list(entry.sources, 'provenance sources');
      for (const source of entry.sources) { sourceRef(source); requireHarness(value.sources.some(item => json(item) === json(source)), 'Provenance must reference a declared source'); }
      unique(entry.sources.map(json), 'provenance sources');
    }
    unique(value.provenance.map(entry => (entry as { output: string }).output), 'provenance outputs');
  }
  if ('projections' in value) {
    list(value.projections, 'projections');
    for (const entry of value.projections) {
      shape(entry, 'projection', ['source', 'target']); sourceRef(entry.source); sourceRef(entry.target);
      requireHarness(json(entry.source) !== json(entry.target), 'A projection needs different source and target files');
      requireHarness(value.sources.some(item => json(item) === json(entry.source)), 'Projection owner must be a declared source');
    }
    unique(value.projections.map(entry => json((entry as { target: HarnessSource }).target)), 'projection targets');
  }
  for (const kind of ['documents', 'resources']) if (kind in value) {
    resources(value[kind]);
    for (const resource of value[kind] as TextResource[]) {
      if (kind === 'documents' && value.documentation_root !== undefined) requireHarness(resource.path.startsWith(`${value.documentation_root}/`), 'Generated documents must stay inside documentation_root');
      if (value.layout === 'centralized') requireHarness(resource.path.startsWith(kind === 'documents' ? '.harness/docs/' : '.harness/resources/'), 'Centralized documents belong in .harness/docs/ and resources in .harness/resources/');
      else requireHarness(!resource.path.startsWith('.harness/') || (kind === 'documents' && value.documentation_root !== undefined && resource.path.startsWith(`${value.documentation_root}/`)), 'The .harness directory is reserved for generated state and runtimes');
    }
  }
  for (const kind of ['skills', 'commands', 'agents']) if (kind in value) {
    list(value[kind], kind);
    for (const item of value[kind] as unknown[]) {
      shape(item, kind, ['name', 'description', 'body', 'resources']); identifier(item.name); text(item.description, 'description'); text(item.body, 'body');
      if ('resources' in item) {
        requireHarness(kind === 'skills', 'Only skills can contain portable resources'); resources(item.resources);
        requireHarness(!(item.resources as TextResource[]).some(resource => resource.path === 'SKILL.md'), 'Skill resources cannot replace SKILL.md');
      }
    }
    unique((value[kind] as HarnessProcedure[]).map(item => item.name), `${kind} names`);
  }
  unique([...(value.skills as HarnessProcedure[] ?? []), ...(value.commands as HarnessProcedure[] ?? [])].map(item => item.name), 'Skill and command names');
  if ('rules' in value) {
    list(value.rules, 'rules');
    for (const rule of value.rules) { shape(rule, 'rule', ['name', 'body']); identifier(rule.name); text(rule.body, 'rule.body'); }
    unique((value.rules as HarnessRule[]).map(rule => rule.name), 'rule names');
  }
  if ('settings' in value) {
    shape(value.settings, 'settings', ['commands', 'codex', 'claude_code']);
    requireHarness(value.settings.codex !== undefined || value.settings.claude_code !== undefined
      || (Array.isArray(value.settings.commands) && value.settings.commands.length > 0), 'Settings need a native configuration or nonempty command policies');
    if ('commands' in value.settings) {
      list(value.settings.commands, 'settings.commands');
      for (const policy of value.settings.commands) {
        shape(policy, 'command policy', ['prefix', 'decision', 'reason']); list(policy.prefix, 'prefix');
        requireHarness(policy.prefix.length && policy.prefix.every(part => typeof part === 'string' && fullMatch(/^[a-zA-Z0-9_./:=@+-]+$/, part)), 'Command prefixes require literal tokens without whitespace or shell metacharacters');
        requireHarness(['ask', 'deny'].includes(policy.decision as string), 'Command policy must ask or deny'); text(policy.reason, 'reason');
      }
    }
    if ('codex' in value.settings) {
      requireHarness(value.targets.includes('codex'), 'Codex settings require the codex target');
      shape(value.settings.codex, 'codex settings', ['sandbox_mode', 'approval_policy']);
      requireHarness(['read-only', 'workspace-write'].includes(value.settings.codex.sandbox_mode as string), 'Choose a read-only or workspace-write sandbox');
      requireHarness(['on-request', 'never'].includes(value.settings.codex.approval_policy as string), 'Unsupported approval policy');
    }
    if ('claude_code' in value.settings) {
      requireHarness(value.targets.includes('claude-code'), 'Claude settings require the claude-code target');
      shape(value.settings.claude_code, 'claude_code settings', ['defaultMode']);
      requireHarness(['default', 'plan', 'dontAsk'].includes(value.settings.claude_code.defaultMode as string), 'Unsupported Claude permission mode');
    }
  }
  if ('hooks' in value) {
    shape(value.hooks, 'hooks', ['guards', 'cases']); list(value.hooks.guards, 'guards'); list(value.hooks.cases, 'cases');
    requireHarness(value.hooks.guards.length > 0 && value.hooks.cases.length > 1, 'Hooks need guards and positive/negative cases');
    for (const guard of value.hooks.guards) {
      shape(guard, 'guard', ['id', 'contains_all', 'reason']); identifier(guard.id); text(guard.reason, 'guard.reason'); list(guard.contains_all, 'contains_all');
      requireHarness(guard.contains_all.length > 0, 'A guard needs nonempty command fragments');
      for (const fragment of guard.contains_all) text(fragment, 'command fragment');
    }
    unique((value.hooks.guards as CommandGuard[]).map(guard => guard.id), 'guard IDs');
    for (const example of value.hooks.cases) {
      shape(example, 'hook case', ['name', 'input', 'expected']); text(example.name, 'case.name');
      requireHarness(isObject(example.input), 'Hook input must be an object'); requireHarness(['pass', 'deny'].includes(example.expected as string), 'Hook case expects pass or deny');
    }
    const cases = value.hooks.cases as HookCase[], guards = value.hooks.guards as CommandGuard[];
    unique(cases.map(example => example.name), 'case names');
    requireHarness(cases.some(example => example.expected === 'pass'), 'Hooks need a non-blocking case');
    for (const guard of guards) requireHarness(cases.some(example => example.expected === 'deny' && evaluateGuard([guard], example.input).guard === guard.id), `Missing blocking case for guard ${guard.id}`);
  }
  if ('ci' in value) {
    shape(value.ci, 'ci', ['provider', 'checks']); requireHarness(value.ci.provider === 'github-actions', 'Currently supported CI provider: github-actions'); list(value.ci.checks, 'ci.checks');
    for (const check of value.ci.checks) {
      shape(check, 'CI check', ['name', 'run', 'working_directory']); text(check.name, 'CI check name'); text(check.run, 'CI command');
      if ('working_directory' in check) harnessPath(check.working_directory);
    }
  }
}
/** These literal guards supplement host permissions; they do not parse or sandbox arbitrary shell programs. */
export function evaluateGuard(guards: CommandGuard[], input: unknown): { decision: 'pass' | 'deny'; reason?: string; guard?: string } {
  if (!isObject(input)) return { decision: 'deny', reason: 'Malformed hook input' };
  if (input.hook_event_name !== 'PreToolUse') return { decision: 'pass' };
  if (!['Bash', 'exec_command', 'shell_command'].includes(input.tool_name as string)) return { decision: 'pass' };
  const args = input.tool_input;
  const command = isObject(args) ? args.command ?? args.cmd : undefined;
  if (typeof command !== 'string' || command.length > 256 * 1024) return { decision: 'deny', reason: 'Cannot inspect this shell tool input' };
  const normalized = command.replace(/\s+/g, ' ');
  const guard = guards.find(item => item.contains_all.every(fragment => normalized.includes(fragment.replace(/\s+/g, ' '))));
  return guard ? { decision: 'deny', reason: guard.reason, guard: guard.id } : { decision: 'pass' };
}
export function hookOutput(result: ReturnType<typeof evaluateGuard>) {
  return result.decision === 'deny' ? { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: result.reason } } : {};
}
export interface GeneratedArtifact { path: string; kind: string; format: 'text' | 'entrypoint' | 'json-merge' | 'toml-merge' | 'symlink'; content: string; executable?: boolean }
export function harnessDocumentRoot(spec: HarnessSpec): string { return spec.documentation_root ?? (spec.layout === 'centralized' ? '.harness/docs' : 'docs/harness'); }
export function harnessConfiguration(spec: HarnessSpec, artifacts: GeneratedArtifact[]) {
  const kinds: Record<HarnessPart, string[]> = {
    documents: ['document'], skills: ['skill', 'skill-resource'], commands: ['command'],
    agents: ['agent'], rules: ['rule'], settings: ['settings'], hooks: ['hook'], ci: ['ci'],
  };
  const parts = Object.fromEntries(HARNESS_PARTS.map(part => [part, spec[part] === undefined ? []
    : artifacts.filter(file => kinds[part].includes(file.kind) || (part === 'hooks'
      && (file.path === '.claude/settings.json' || file.path === '.harness/runtime/hook.mjs'))).map(file => file.path)])) as Record<HarnessPart, string[]>;
  return {
    layout: spec.layout ?? 'native',
    discovery: spec.layout === 'centralized' ? 'entrypoint-routed' : 'native',
    documentation_policy: { root: harnessDocumentRoot(spec), new_ai_documents: 'inside-root', existing_documents: 'ask-before-moving', enforcement: 'agent-instructions' },
    kind: HARNESS_PARTS.some(part => part !== 'documents' && parts[part].length) ? 'repository-harness'
      : parts.documents.length ? 'documents-only' : 'entrypoints-only',
    targets: spec.targets.map(target => ({ target, entrypoint: target === 'codex' ? 'AGENTS.md' : 'CLAUDE.md' })),
    parts,
  };
}
export interface HarnessRuntimes { check: string; hook: string; notices: string; localContext?: string; localContextRuntime?: string }
function frontmatter(item: HarnessProcedure, extra = ''): string { return `---\nname: ${JSON.stringify(item.name)}\ndescription: ${JSON.stringify(item.description)}\n${extra}---\n\n${item.body.trim()}\n`; }
export function renderHarness(spec: unknown, runtimes: HarnessRuntimes): GeneratedArtifact[] {
  validateHarnessSpec(spec);
  const chinese = spec.language === 'zh-CN';
  const artifacts: GeneratedArtifact[] = [], routes: string[] = [];
  const add = (path: string, kind: string, content: string, format: GeneratedArtifact['format'] = 'text', executable = false) => artifacts.push({ path, kind, format, content, executable });
  for (const document of spec.documents ?? []) { add(document.path, 'document', document.body.trim() + '\n'); routes.push(`- [${document.path}](${document.path})`); }
  for (const resource of spec.resources ?? []) add(resource.path, 'resource', resource.body, 'text', resource.executable);
  if (spec.layout === 'centralized') {
    for (const skill of spec.skills ?? []) {
      const folder = `.harness/skills/${skill.name}`;
      add(`${folder}/SKILL.md`, 'skill', frontmatter(skill));
      routes.push(`- ${skill.description} — [${skill.name}](${folder}/SKILL.md)`);
      for (const resource of skill.resources ?? []) add(`${folder}/${resource.path}`, 'skill-resource', resource.body, 'text', resource.executable);
    }
    for (const command of spec.commands ?? []) {
      const file = `.harness/commands/${command.name}.md`;
      add(file, 'command', frontmatter(command));
      routes.push(chinese ? `- 按需执行「${command.description}」，阅读 [${command.name}](${file})。` : `- For ${command.description}, follow [${command.name}](${file}).`);
    }
    for (const agent of spec.agents ?? []) {
      const file = `.harness/agents/${agent.name}.md`;
      add(file, 'agent', frontmatter(agent));
      routes.push(chinese ? `- 需要且允许委派时，按 [${agent.name}](${file}) 的任务说明执行：${agent.description}` : `- When delegation is appropriate and allowed, use [${agent.name}](${file}): ${agent.description}`);
    }
    for (const rule of spec.rules ?? []) {
      const file = `.harness/rules/${rule.name}.md`;
      add(file, 'rule', rule.body.trim() + '\n');
      routes.push(chinese ? `- 必读规则：[${rule.name}](${file})。` : `- Required guidance: [${rule.name}](${file}).`);
    }
  }
  for (const target of spec.layout === 'centralized' ? [] : spec.targets) {
    const base = target === 'codex' ? '.agents' : '.claude';
    for (const skill of spec.skills ?? []) {
      const folder = `${base}/skills/${skill.name}`;
      add(`${folder}/SKILL.md`, 'skill', frontmatter(skill)); routes.push(`- ${target}: ${skill.description} — [${skill.name}](${folder}/SKILL.md)`);
      for (const resource of skill.resources ?? []) add(`${folder}/${resource.path}`, 'skill-resource', resource.body, 'text', resource.executable);
    }
    for (const command of spec.commands ?? []) {
      const file = target === 'codex' ? `${base}/skills/${command.name}/SKILL.md` : `${base}/commands/${command.name}.md`;
      add(file, 'command', frontmatter(command, target === 'claude-code' ? 'disable-model-invocation: true\n' : ''));
      if (target === 'codex') add(`${base}/skills/${command.name}/agents/openai.yaml`, 'command', 'policy:\n  allow_implicit_invocation: false\n');
      routes.push(chinese
        ? `- ${target}：调用 ${target === 'codex' ? '$' : '/'}${command.name}，参见[操作步骤](${file})。`
        : `- ${target}: invoke ${target === 'codex' ? '$' : '/'}${command.name} — [procedure](${file})`);
    }
    for (const agent of spec.agents ?? []) {
      const file = target === 'codex' ? `.codex/agents/${agent.name}.toml` : `.claude/agents/${agent.name}.md`;
      const content = target === 'codex'
        ? `name = ${JSON.stringify(agent.name)}\ndescription = ${JSON.stringify(agent.description)}\ndeveloper_instructions = ${JSON.stringify(agent.body)}\n`
        : frontmatter(agent);
      add(file, 'agent', content); routes.push(chinese
        ? `- ${target}：任务需要时，将「${agent.description}」委派给 [${agent.name}](${file})；沿用父级权限。`
        : `- ${target}: delegate ${agent.description} to [${agent.name}](${file}) when the task calls for it; parent permissions apply.`);
    }
    for (const rule of spec.rules ?? []) {
      const file = target === 'codex' ? `.harness/rules/${rule.name}.md` : `.claude/rules/${rule.name}.md`;
      add(file, 'rule', rule.body.trim() + '\n'); routes.push(chinese
        ? `- ${target} 的必读规则：在适用范围内执行操作前，阅读 [${rule.name}](${file})。`
        : `- Required guidance for ${target}: read [${rule.name}](${file}) before acting in its scope.`);
    }
  }
  const introduction = chinese
    ? '在选定的工作区中遵循已有说明，并通过受忽略的本地 Markdown 入口定位成员仓库。'
    : 'Use the selected workspace and its existing instructions. Resolve member checkout paths through the established local mapping.';
  const verification = chinese
    ? '配置与本地验证参见 [harness 配置](.harness/harness.json)。修改后运行 `node .harness/runtime/check.mjs --workspace .`。检查通过不代表 Agent 已加载配置，也不代表已具备部署条件。'
    : 'Configuration and local verification: [harness specification](.harness/harness.json). Run `node .harness/runtime/check.mjs --workspace .` after changes. A passing check does not establish agent activation or deployment readiness.';
  const routing = spec.layout === 'centralized' ? (chinese
    ? '\n\nAGENTS.md 是统一入口正文；其他宿主入口软链到它。按任务读取下列流程和规则；这些内容通过本入口使用，不注册宿主原生斜杠命令、自动发现的 Skills 或子代理。'
    : '\n\nAGENTS.md is the canonical entry point; other host entry points link to it. Read the relevant procedures and rules below. These are entry-point-routed instructions, not registered native commands, automatically discovered Skills or agents.') : '';
  const documentRoot = harnessDocumentRoot(spec);
  const documentPolicy = chinese
    ? `## 文档存放规则\n\n后续所有由 AI 新增的项目文档（包括计划、设计、分析、验证报告和交接记录）必须放在 \`${documentRoot}/\`，按主题组织并更新该目录的索引。 本仓库内的文件和工作流按用途命名，省略重复的仓库名或项目名前缀；只有需要区分组件时才加限定词。不得在仓库根目录或其他目录新增此类文档或重复副本。AGENTS.md 与宿主入口只保留规则和导航；工具要求的配置、Skill 和运行文件按各自约定存放。\n\n发现其他位置的现有文档时，先列出原路径、拟迁入路径和需要更新的引用，询问用户选择迁入哪些文档、保留哪些文档；已有明确选择时直接沿用。未经选择不移动或删除原文，保留原位的文档通过链接引用。迁移须保留内容，检查重名、修复相对链接及调用方，再核对来源与文档完整性。`
    : `## Documentation location\n\nAll new project documentation written by AI, including plans, designs, analyses, validation reports and handoff notes, must live under \`${documentRoot}/\`. Organize it by topic and update that directory's index. Name repository-local files and workflows by purpose, without repeating the repository or product name; add a component qualifier only when needed to distinguish workflows. Do not create these documents or duplicate copies at the repository root or elsewhere. AGENTS.md and host entry points contain rules and navigation; tool-required configuration, Skills and runtime files retain their prescribed locations.\n\nWhen existing documents are found elsewhere, list their current paths, proposed destinations and affected references, then ask the user which to move and which to keep. Reuse an explicit prior choice. Do not move or delete unselected originals; link to documents kept in place. For a selected move, preserve content, check collisions, repair relative links and callers, then verify sources and documentation completeness.`;
  const localContext = runtimes.localContext ?? DEFAULT_LOCAL_CONTEXT;
  const localPolicy = chinese
    ? `需要本机仓库路径、环境、工具或个人访问上下文时，先读取[可选本地入口](${localContext})。本地文件按 *.local.md 忽略，由本地配置流程维护，不属于共享生成产物；使用 \`node .harness/runtime/local-context.mjs --workspace .\` 统一解析和校验身份。新机器缺少文件时补齐绑定并重新验证，不继承他人的就绪状态。凭据值继续保存在环境变量或系统凭据存储中。`
    : `For machine checkout paths, environment, tools or personal access context, first read the [optional local entry](${localContext}). Files matching *.local.md are ignored and maintained by local configuration, outside shared generation. Use \`node .harness/runtime/local-context.mjs --workspace .\` for the shared parser and identity checks. On a new machine, supply bindings and reverify readiness; do not inherit another machine's observations. Keep credential values in environment variables or existing credential stores.`;
  const entry = `# ${spec.name}\n\n${introduction}${routing}\n\n${documentPolicy}\n\n${localPolicy}\n\n${routes.join('\n')}\n\n${verification}\n`;
  if (spec.targets.includes('codex') || spec.layout === 'centralized') add('AGENTS.md', 'entrypoint', entry, 'entrypoint');
  if (spec.targets.includes('claude-code')) add('CLAUDE.md', spec.layout === 'centralized' ? 'entrypoint-alias' : 'entrypoint', spec.layout === 'centralized' ? 'AGENTS.md' : entry, spec.layout === 'centralized' ? 'symlink' : 'entrypoint');
  if (spec.targets.includes('codex') && spec.settings?.codex) add('.codex/config.toml', 'settings', json(spec.settings.codex), 'toml-merge');
  if (spec.targets.includes('codex') && spec.settings?.commands?.length) {
    add('.codex/rules/harness.rules', 'settings', spec.settings.commands.map(policy => `prefix_rule(pattern = ${JSON.stringify(policy.prefix)}, decision = ${JSON.stringify(policy.decision === 'deny' ? 'forbidden' : 'prompt')}, justification = ${JSON.stringify(policy.reason)})`).join('\n') + '\n');
  }
  const hookCommand = 'node "$(git rev-parse --show-toplevel)/.harness/runtime/hook.mjs"';
  const hooks = { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: hookCommand, timeout: 10 }] }] };
  if (spec.targets.includes('codex') && spec.hooks) add('.codex/hooks.json', 'hook', json({ hooks }), 'json-merge');
  if (spec.targets.includes('claude-code') && (spec.settings || spec.hooks)) {
    const settings: Record<string, unknown> = {}, permissions: Record<string, unknown> = {};
    for (const decision of ['ask', 'deny']) {
      const entries = (spec.settings?.commands ?? []).filter(policy => policy.decision === decision).flatMap(policy => [`Bash(${policy.prefix.join(' ')})`, `Bash(${policy.prefix.join(' ')} *)`]);
      if (entries.length) permissions[decision] = entries;
    }
    if (spec.settings?.claude_code) permissions.defaultMode = spec.settings.claude_code.defaultMode;
    if (Object.keys(permissions).length) settings.permissions = permissions;
    if (spec.hooks) settings.hooks = hooks;
    add('.claude/settings.json', 'settings', json(settings), 'json-merge');
  }
  if (spec.ci) {
    // JSON is a YAML subset: emit a workflow that can also be parsed without a YAML runtime dependency.
    add('.github/workflows/harness-gate.yml', 'ci', json({ name: 'Harness gate', on: { pull_request: {}, push: {}, workflow_call: {} }, permissions: { contents: 'read' },
      jobs: { harness: { 'runs-on': 'ubuntu-latest', 'timeout-minutes': 10, steps: [
        { uses: 'actions/checkout@v7', with: { 'persist-credentials': false } },
        { uses: 'actions/setup-node@v7', with: { 'node-version': '24', 'package-manager-cache': false } },
        { name: 'Validate generated harness and hook cases', run: 'node .harness/runtime/check.mjs --workspace .' },
        ...spec.ci.checks.map(check => ({ name: check.name, run: check.run, ...(check.working_directory ? { 'working-directory': check.working_directory } : {}) })),
      ] } } }));
  }
  add('.harness/runtime/check.mjs', 'runtime', runtimes.check, 'text', true);
  if (spec.hooks) add('.harness/runtime/hook.mjs', 'runtime', runtimes.hook, 'text', true);
  add('.harness/runtime/THIRD-PARTY-NOTICES.txt', 'runtime', runtimes.notices);
  add('.harness/runtime/local-context.mjs', 'runtime', runtimes.localContextRuntime ?? '', 'text', true);
  add('.harness/harness.json', 'spec', json(spec));
  unique(artifacts.map(artifact => artifact.path), 'generated paths');
  const paths = artifacts.map(artifact => artifact.path.toLowerCase()).sort();
  unique(paths, 'case-insensitive generated paths');
  const names = new Set(paths);
  for (const entry of spec.provenance ?? []) requireHarness(artifacts.some(item => item.path === entry.output), `Unknown provenance output: ${entry.output}`);
  for (const entry of spec.command_checks ?? []) requireHarness(artifacts.some(item => item.path === entry.document), `Unknown command document: ${entry.document}`);
  for (const entry of spec.document_coverage ?? []) requireHarness(spec.documents?.some(item => item.path === entry.path)
    || spec.sources.some(source => !source.member && source.path === entry.path), `Coverage must reference a generated document or declared local source: ${entry.path}`);
  for (const file of paths) {
    const parts = file.split('/');
    for (let index = 1; index < parts.length; index++) requireHarness(!names.has(parts.slice(0, index).join('/')), 'A generated file cannot also be a parent directory');
  }
  return artifacts;
}
