import { isObject, json } from './json.js';
import { relativePath, requireWorkspace, schema, validateId } from './registry.js';
import type { LocalManifest } from './types.js';

export const LOCAL_START = '<!-- workspace-harness-kit:local-context:start -->';
export const LOCAL_END = '<!-- workspace-harness-kit:local-context:end -->';
export const DEFAULT_LOCAL_CONTEXT = '.harness/docs/workspace.local.md';
export const LEGACY_LOCAL_CONTEXT = '.harness/workspace.local.json';
export function localContextPath(value: unknown): string {
  const name = relativePath(value);
  requireWorkspace(name.endsWith('.local.md'), 'Local context must be a repository-relative *.local.md file');
  return name;
}
export function isLocalResource(file: string): boolean {
  return file.endsWith('.local.md') || file.endsWith('.local.json') || file === LEGACY_LOCAL_CONTEXT || file.startsWith('.harness/local-backups/') || file.startsWith('.harness/local-evidence/');
}
export function validateLocalContext(value: unknown): asserts value is LocalManifest {
  schema(value);
  const fields = ['schema_version', 'checkouts', 'machine', 'tools', 'environment', 'access', 'execution', 'state', 'onboarding_status'];
  requireWorkspace(Object.keys(value).every(key => fields.includes(key)), 'Unknown local-context field; put project-specific state under state');
  requireWorkspace(isObject(value.checkouts), 'Local checkouts must be an object keyed by member ID');
  if ('machine' in value) requireWorkspace(typeof value.machine === 'string' && /^[a-f0-9]{64}$/.test(value.machine), 'Invalid local machine fingerprint');
  for (const [id, binding] of Object.entries(value.checkouts)) {
    validateId(id);
    requireWorkspace(isObject(binding) && Object.keys(binding).every(key => ['path', 'git_common_dir'].includes(key)), `Invalid checkout fields: ${id}`);
    for (const field of ['path', 'git_common_dir']) requireWorkspace(typeof binding[field] === 'string' && !!binding[field] && !/[\x00-\x1f\x7f]/.test(binding[field]), `Expected a local ${field} for ${id}`);
  }
  for (const field of ['tools', 'environment', 'access', 'execution', 'state', 'onboarding_status']) if (field in value) requireWorkspace(isObject(value[field]), `Local ${field} must be an object`);
}
/** Parse only one bounded JSON fence in the named block. Markdown and shell are never executed. */
export function parseLocalContext(markdown: string): LocalManifest | undefined {
  requireWorkspace(Buffer.byteLength(markdown, 'utf8') <= 1024 * 1024, 'Local context exceeds the 1 MiB limit');
  const start = markdown.indexOf(LOCAL_START), end = markdown.indexOf(LOCAL_END);
  if (start < 0 && end < 0) return undefined;
  requireWorkspace(start >= 0 && end > start && markdown.indexOf(LOCAL_START, start + LOCAL_START.length) < 0 && markdown.indexOf(LOCAL_END, end + LOCAL_END.length) < 0, 'Malformed or repeated local-context markers');
  const content = markdown.slice(start + LOCAL_START.length, end).trim();
  const match = /^```json\r?\n([\s\S]*?)\r?\n```$/.exec(content);
  requireWorkspace(match && !match[1].includes('```'), 'Local context needs exactly one JSON fenced block');
  let data: unknown;
  try { data = JSON.parse(match[1]); } catch { throw new Error('Malformed local-context JSON'); }
  validateLocalContext(data); return data;
}
export function renderLocalContext(markdown: string, data: LocalManifest): string {
  validateLocalContext(data);
  const previous = parseLocalContext(markdown);
  const block = `${LOCAL_START}\n\`\`\`json\n${json(data).trimEnd()}\n\`\`\`\n${LOCAL_END}`;
  const output = previous ? markdown.slice(0, markdown.indexOf(LOCAL_START)) + block + markdown.slice(markdown.indexOf(LOCAL_END) + LOCAL_END.length)
    : markdown + (markdown && !markdown.endsWith('\n') ? '\n' : '') + (markdown ? '\n' : '') + block + '\n';
  requireWorkspace(Buffer.byteLength(output, 'utf8') <= 1024 * 1024, 'Local context exceeds the 1 MiB limit; link raw evidence instead');
  return output;
}
