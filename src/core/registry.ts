import type { Capability, Component, DocumentReview, Fingerprint, Member, Relationship } from './types.js';
import { equal, fullMatch, isObject } from './json.js';
import { identifier, requireEvidence, uniqueNames } from './evidence.js';
import { validateOnboarding } from './onboarding.js';

export const MODES = ['register', 'analyze', 'init'] as const;
export const RELATIONSHIPS = ['starts_after', 'deploys_after', 'consumes', 'validated_by', 'requires'] as const;
export class WorkspaceError extends Error { override name = 'WorkspaceError'; }
export function requireWorkspace(condition: unknown, message: string): asserts condition {
  if (!condition) throw new WorkspaceError(message);
}
const optional = (value: Record<string, unknown>, key: string, fallback: unknown): unknown => Object.hasOwn(value, key) ? value[key] : fallback;
export function validateId(value: unknown): asserts value is string {
  requireWorkspace(typeof value === 'string' && fullMatch(/^[a-z0-9][a-z0-9._-]*$/, value), `Invalid member ID: ${String(value)}. Use lowercase letters, numbers, dots, dashes, or underscores.`);
}
export function validateLanguage(value: unknown): asserts value is string {
  requireWorkspace(typeof value === 'string' && fullMatch(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/, value), `Invalid language tag: ${String(value)}. Use a tag such as en or zh-CN.`);
}
export function relativePath(value: unknown): string {
  requireWorkspace(typeof value === 'string' && value.length > 0 && !/[\\:\0]/.test(value)
    && value.split('/').every(part => part && part !== '.' && part !== '..'), `Invalid relative file reference: ${String(value)}`);
  return value;
}
export function schema(value: unknown): asserts value is Record<string, unknown> {
  requireWorkspace(isObject(value) && value.schema_version === 1, 'Expected workspace schema version 1.');
}
export function docRefs(value: unknown): asserts value is string[] {
  requireWorkspace(Array.isArray(value), 'Document references must be a list of relative paths.');
  for (const item of value) relativePath(item);
}
export function fingerprints(value: unknown): Record<string, string> {
  requireWorkspace(Array.isArray(value), 'Source fingerprints must be a list.');
  const entries = new Map<string, string>();
  for (const source of value) {
    requireWorkspace(isObject(source), 'Each source fingerprint must be an object.');
    const path = relativePath(source.path), digest = source.sha256;
    requireWorkspace(!entries.has(path) && typeof digest === 'string' && fullMatch(/^[a-f0-9]{64}$/, digest), `Invalid or repeated source fingerprint: ${path}`);
    entries.set(path, digest);
  }
  return Object.fromEntries(entries);
}
export interface ComponentModel {
  components: Record<string, Component & { path: string }>;
  orders: { starts_after: string[]; deploys_after: string[] };
  capabilities: Capability[];
}
export function componentModel(value: Record<string, unknown>, members: Record<string, unknown>): ComponentModel {
  const components = new Map<string, Component & { path: string }>(), explicitMembers = new Set<string>();
  const entries = optional(value, 'components', []);
  requireWorkspace(Array.isArray(entries), 'Components must be a list.');
  for (const item of entries) {
    requireWorkspace(isObject(item), 'Each component must be an object.');
    validateId(item.id); validateId(item.member);
    requireWorkspace(!components.has(item.id) && Object.hasOwn(members, item.member), `Repeated component or unknown member: ${item.id}`);
    const path = optional(item, 'path', '.');
    if (path !== '.') relativePath(path);
    components.set(item.id, { ...item, id: item.id, member: item.member, path: path as string });
    explicitMembers.add(item.member);
  }
  for (const id of Object.keys(members).sort()) if (!explicitMembers.has(id)) {
    requireWorkspace(!components.has(id), `Component shadows an implicit component: ${id}`);
    components.set(id, { id, member: id, path: '.' });
  }
  const relationships = optional(value, 'relationships', []);
  requireWorkspace(Array.isArray(relationships), 'Relationships must be a list.');
  const seen = new Set<string>();
  for (const edge of relationships) {
    requireWorkspace(isObject(edge), 'Each relationship must be an object.');
    requireWorkspace(typeof edge.type === 'string' && typeof edge.from === 'string' && typeof edge.to === 'string', 'A relationship needs string type, from, and to fields.');
    requireWorkspace((RELATIONSHIPS as readonly string[]).includes(edge.type), `Unknown relationship type: ${edge.type}`);
    const key = JSON.stringify([edge.type, edge.from, edge.to]);
    requireWorkspace(components.has(edge.from) && components.has(edge.to) && edge.from !== edge.to && !seen.has(key), `Invalid or repeated relationship: ${key}`);
    seen.add(key);
  }
  const orders: ComponentModel['orders'] = { starts_after: [], deploys_after: [] };
  for (const kind of ['starts_after', 'deploys_after'] as const) {
    const remaining = new Map([...components.keys()].map(key => [key, new Set<string>()]));
    for (const edge of relationships as Relationship[]) if (edge.type === kind) remaining.get(edge.from)!.add(edge.to);
    while (remaining.size) {
      const ready = [...remaining].filter(([, deps]) => !deps.size).map(([key]) => key).sort();
      requireWorkspace(ready.length, `Cycle in ${kind}: ${[...remaining.keys()].sort().join(', ')}`);
      orders[kind].push(...ready);
      for (const key of ready) remaining.delete(key);
      for (const dependencies of remaining.values()) for (const key of ready) dependencies.delete(key);
    }
  }
  const capabilities = optional(value, 'capabilities', []);
  requireWorkspace(Array.isArray(capabilities), 'Capabilities must be a list.');
  seen.clear();
  for (const item of capabilities) {
    requireWorkspace(isObject(item), 'Each capability must be an object.');
    validateId(item.id);
    requireWorkspace(!seen.has(item.id) && Array.isArray(item.requires) && item.requires.length, `Invalid or repeated capability: ${item.id}`);
    for (const id of item.requires) {
      validateId(id); requireWorkspace(components.has(id), `Unknown component for ${item.id}: ${id}`);
    }
    requireWorkspace(item.requires.length === new Set(item.requires).size, `Repeated required component for ${item.id}`);
    seen.add(item.id);
  }
  return { components: Object.fromEntries(components), orders, capabilities: capabilities as Capability[] };
}
export function validateManifest(value: unknown): Record<string, Member> {
  schema(value); validateLanguage(value.language); docRefs(optional(value, 'documents', []));
  if ('onboarding' in value) validateOnboarding(value.onboarding);
  requireWorkspace(Array.isArray(value.members), 'Workspace members must be a list.');
  const members = new Map<string, Member>(), remotes = new Set<string>();
  for (const member of value.members) {
    requireWorkspace(isObject(member), 'Each workspace member must be an object.');
    validateId(member.id);
    requireWorkspace(!members.has(member.id), `Repeated member ID: ${member.id}`);
    requireWorkspace(typeof member.mode === 'string' && (MODES as readonly string[]).includes(member.mode), `Unknown member mode for ${member.id}.`);
    if ('language' in member) validateLanguage(member.language);
    if ('remote' in member) {
      const remote = member.remote;
      requireWorkspace(typeof remote === 'string' && fullMatch(/^[^/@?#\s]+\/[^@?#\s]+$/, remote) && !remote.includes('://'), `Invalid credential-free remote identity for ${member.id}.`);
      requireWorkspace(!remotes.has(remote), `Repeated remote identity for ${member.id}: ${remote}`);
      remotes.add(remote);
    }
    docRefs(optional(member, 'documents', [])); fingerprints(optional(member, 'sources', [])); docRefs(optional(member, 'source_files', []));
    const reviews = optional(member, 'document_reviews', []);
    requireWorkspace(Array.isArray(reviews), 'Document reviews must be a list.');
    const seen = new Set<string>();
    for (const review of reviews) {
      fingerprints([review]);
      const item = review as DocumentReview;
      if ('onboarding_sha256' in item) fingerprints([{ path: item.path, sha256: item.onboarding_sha256 }]);
      requireWorkspace(!seen.has(item.path) && ((member.documents ?? []) as string[]).includes(item.path), `Repeated or unlinked document review for ${member.id}: ${item.path}`);
      fingerprints(item.sources); seen.add(item.path);
    }
    members.set(member.id, member as unknown as Member);
  }
  for (const [id, member] of members) {
    const dependencies = optional(member, 'depends_on', []);
    requireWorkspace(Array.isArray(dependencies), `Dependencies for ${id} must be a list of member IDs.`);
    for (const dep of dependencies) {
      validateId(dep); requireWorkspace(dep !== id && members.has(dep), `Invalid dependency for ${id}: ${dep}`);
    }
  }
  const result = Object.fromEntries(members);
  componentModel(value, result);
  return result;
}
export function sourceSnapshot(inventory: Array<{ path: string; sha256?: string }>): Fingerprint[] {
  return inventory.filter((item): item is { path: string; sha256: string } => typeof item.sha256 === 'string')
    .map(({ path, sha256 }) => ({ path, sha256 }));
}
export function documentFreshness(review: DocumentReview | undefined, digest: string | null,
  current: Record<string, string>, invalidSources: boolean, onboardingDigest?: string): string | null {
  if (!review) return 'no review baseline';
  if (digest !== review.sha256) return 'document changed or unavailable';
  if (review.onboarding_sha256 !== onboardingDigest) return 'initialization choices changed';
  if (invalidSources || !equal(fingerprints(review.sources), Object.fromEntries(Object.entries(current).filter(([path]) => path !== review.path)))) return 'review inputs changed';
  return null;
}
/** Capability checking accepts a minimal registry without local bindings or adoption metadata. */
export function checkWorkspaceScope(record: { capability?: string; scope: { components: { id: string }[] } }, manifest: unknown): void {
  requireEvidence(isObject(manifest) && manifest.schema_version === 1, 'Unsupported workspace schema');
  requireEvidence(record.capability !== undefined, 'Workspace-bound evidence needs a capability ID');
  identifier(record.capability, 'capability');
  requireEvidence(Array.isArray(manifest.capabilities), 'Workspace capabilities must be a list');
  const matches = manifest.capabilities.filter(item => isObject(item) && item.id === record.capability);
  requireEvidence(matches.length === 1, 'Capability must resolve uniquely in the workspace');
  uniqueNames(matches[0].requires, 'required capability component');
  const needed = new Set<string>(matches[0].requires);
  requireEvidence(needed.size, 'Capability must require components');
  const explicit = manifest.components ?? [];
  requireEvidence(Array.isArray(explicit) && Array.isArray(manifest.members), 'Workspace members and components must be lists');
  const memberIds = manifest.members.map(item => isObject(item) ? item.id : null);
  const componentIds = explicit.map(item => isObject(item) ? item.id : null);
  uniqueNames(memberIds, 'workspace member'); uniqueNames(componentIds, 'workspace component');
  const members = Object.fromEntries(memberIds.map(id => [id, {}]));
  const model = componentModel(manifest, members);
  const edges = (manifest.relationships ?? []) as Relationship[];
  let size = 0;
  while (needed.size !== size) {
    size = needed.size;
    for (const edge of edges) if (edge.type === 'requires' && needed.has(edge.from)) needed.add(edge.to);
  }
  const selected = new Set(record.scope.components.map(item => item.id));
  requireEvidence([...needed, ...selected].every(id => Object.hasOwn(model.components, id)), 'Scope or capability references an unknown workspace component');
  const missing = [...needed].filter(id => !selected.has(id)).sort();
  requireEvidence(!missing.length, `Evidence scope omits required components: ${missing.join(', ')}`);
}
