import fs from 'node:fs';
import type { HarnessSpec } from '../core/harness.js';
import { requiredDocumentTopics } from '../core/documentation.js';
import { markdownSection } from '../core/markdown.js';
import { isObject } from '../core/json.js';
import { readJson, stat, within } from './files.js';

export function checkDocumentCoverage(root: string, spec: HarnessSpec) {
  const manifest = readJson(within(root, '.harness/workspace.json'), {});
  const required = requiredDocumentTopics(isObject(manifest) ? manifest.onboarding : undefined);
  const requirements = [...required, ...(spec.document_coverage ?? []).filter(entry => !required.some(item => item.topic === entry.topic))];
  const topics = requirements.map(requirement => {
    const entry = spec.document_coverage?.find(item => item.topic === requirement.topic) ?? requirement;
    const heading = 'heading' in entry && typeof entry.heading === 'string' ? entry.heading : undefined;
    try {
      if (!spec.documents?.some(item => item.path === entry.path) && !spec.sources.some(source => !source.member && source.path === entry.path)) return { ...entry, status: 'missing', reason: 'Topic needs a generated guide or an explicit mapping to a declared source' };
      const file = within(root, entry.path);
      if (!stat(file)?.isFile()) return { ...entry, status: 'missing', reason: 'Document is unavailable' };
      const section = markdownSection(fs.readFileSync(file, 'utf8'), heading);
      if (section === undefined) return { ...entry, status: 'missing', reason: 'Mapped heading is absent or ambiguous' };
      if (!section) return { ...entry, status: 'missing', reason: 'Document or mapped section has no body' };
      return { ...entry, status: 'present', reason: 'Guide content is present; factual accuracy and executable handoff require review' };
    } catch { return { ...entry, status: 'missing', reason: 'Document cannot be read within the workspace' }; }
  });
  return { status: !topics.length ? 'not configured' : topics.some(topic => topic.status === 'missing') ? 'incomplete' : 'covered', topics,
    content_review: 'not attested', execution: 'not established by document coverage' };
}
