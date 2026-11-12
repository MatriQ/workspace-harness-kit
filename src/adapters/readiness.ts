import { validateReadinessPlan } from '../core/readiness.js';
import { evaluateVerification } from '../core/verification.js';
import { json } from '../core/json.js';
import { hash } from './files.js';

export function evaluateReadiness(plan: unknown, record: unknown = { schema_version: 1, observations: [] }, at = new Date().toISOString()) {
  validateReadinessPlan(plan);
  const binding = hash(json(plan));
  const result = evaluateVerification(plan.checks.map(check => ({ id: check.id, layer: check.area, criterion: check.criterion, target: plan.target })), record, binding, plan.max_age_seconds, at);
  return { ...result, release: plan.release, target: plan.target, artifacts: plan.artifacts, not_applicable: plan.not_applicable,
    decision: result.status === 'passed' ? 'ready' : result.status === 'failed' ? 'not-ready' : 'pending',
    authorization: 'Use the existing project and session authorization; this evidence decision does not grant deployment permission',
    deployment: 'not run', record };
}
