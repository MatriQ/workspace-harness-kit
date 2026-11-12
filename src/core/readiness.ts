import { identifier, object, requireEvidence, text, validateArtifact, validateTarget } from './evidence.js';
import { isObject } from './json.js';
import type { Artifact, Target } from './types.js';

export const READINESS_AREAS = ['artifact', 'rollback', 'migration', 'monitoring', 'review'] as const;
export type ReadinessArea = typeof READINESS_AREAS[number];
export interface ReadinessPlan {
  schema_version: 1; release: string; target: Target; artifacts: Array<{ component: string; artifact: Artifact }>; max_age_seconds: number;
  checks: Array<{ id: string; area: ReadinessArea; criterion: string }>;
  not_applicable: Partial<Record<ReadinessArea, string>>;
}
export function validateReadinessPlan(value: unknown): asserts value is ReadinessPlan {
  object(value, 'readiness plan', ['schema_version', 'release', 'target', 'artifacts', 'max_age_seconds', 'checks', 'not_applicable']);
  requireEvidence(value.schema_version === 1, 'Expected readiness schema_version 1'); text(value.release, 'release'); validateTarget(value.target);
  requireEvidence(Number.isSafeInteger(value.max_age_seconds) && Number(value.max_age_seconds) > 0, 'max_age_seconds must be positive');
  requireEvidence(Array.isArray(value.artifacts) && value.artifacts.length > 0, 'Readiness must bind at least one intended artifact');
  const components = new Set<string>();
  for (const item of value.artifacts) {
    object(item, 'readiness artifact', ['component', 'artifact']); identifier(item.component, 'component'); validateArtifact(item.artifact);
    requireEvidence(!components.has(item.component), 'Repeated readiness component'); components.add(item.component);
  }
  requireEvidence(Array.isArray(value.checks) && value.checks.length > 0, 'Readiness needs required checks');
  const ids = new Set<string>(), areas = new Set<string>();
  for (const check of value.checks) {
    object(check, 'readiness check', ['id', 'area', 'criterion']); identifier(check.id, 'readiness check'); text(check.criterion, 'criterion');
    requireEvidence(!ids.has(check.id), 'Repeated readiness check'); ids.add(check.id);
    requireEvidence(READINESS_AREAS.includes(check.area as ReadinessArea), 'Unknown readiness area'); areas.add(String(check.area));
  }
  requireEvidence(isObject(value.not_applicable), 'not_applicable must map areas to reasons');
  const exclusions = value.not_applicable;
  for (const [area, reason] of Object.entries(value.not_applicable)) { requireEvidence(READINESS_AREAS.includes(area as ReadinessArea) && !areas.has(area), 'Unknown or duplicated readiness classification'); text(reason, 'exclusion reason'); }
  requireEvidence(areas.has('artifact'), 'Artifact readiness is required');
  requireEvidence(READINESS_AREAS.every(area => areas.has(area) || Object.hasOwn(exclusions, area)), 'Classify every readiness area; exclusions require project-specific reasons');
}
