import { isObject } from './json.js';

export const DOCUMENT_TOPICS = ['index', 'development', 'testing', 'environments', 'release', 'operations', 'toolchain'] as const;
export type DocumentTopic = typeof DOCUMENT_TOPICS[number];
export interface DocumentCoverage { topic: DocumentTopic; path: string; heading?: string }
/** Topic requirements follow explicit activity choices; filenames remain overridable by coverage mappings. */
export function requiredDocumentTopics(profile: unknown): Array<{ topic: DocumentTopic; path: string }> {
  if (!isObject(profile) || !isObject(profile.harness) || !isObject(profile.harness.artifacts) || profile.harness.artifacts.documents !== true) return [];
  const activities = isObject(profile.activities) ? profile.activities : {};
  const root = isObject(profile.documentation) && typeof profile.documentation.root === 'string' ? profile.documentation.root : profile.harness.layout === 'centralized' ? '.harness/docs' : 'docs/harness';
  const topics: DocumentTopic[] = ['index'];
  if (activities.development === true) topics.push('development');
  if (activities.testing === true) topics.push('testing');
  if (activities.deployment === true || activities.operations === true) topics.push('environments');
  if (activities.deployment === true) topics.push('release');
  if (activities.operations === true) topics.push('operations');
  if (['development', 'testing', 'deployment', 'operations'].some(activity => activities[activity] === true)) topics.push('toolchain');
  return topics.map(topic => ({ topic, path: `${root}/${topic}.md` }));
}
