import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makePlan, applyPlan } from '../dist/workspace.js';
import { makeHarnessPlan, applyHarnessPlan } from '../dist/harness.js';
import { checkHarness } from '../dist/harness-check.js';
import { validateHarnessSpec } from '../dist/index.js';
import { temporary, writeJson } from './helpers.mjs';

function fixture(t) {
  const root = temporary(t);
  const profile = { schema_version: 1, background: 'Local documentation exercise', activities: { development: true, testing: true, deployment: false, operations: false }, tool_policy: 'inspect-only',
    harness: { targets: ['codex'], artifacts: Object.fromEntries(['documents','skills','commands','agents','rules','settings','hooks','ci'].map(part => [part, part === 'documents'])) } };
  applyPlan(makePlan(root, [], null, [], { profile }));
  const spec = { schema_version: 1, name: 'Documentation exercise', targets: ['codex'], sources: [], documents: [{ path: 'docs/harness/index.md', body: '# Overview\n\nRead the project guide for the selected task.' }] };
  return { root, profile, spec, apply() { applyHarnessPlan(makeHarnessPlan(root, spec)); } };
}
test('artifact integrity cannot mask missing documentation for selected activities', t => {
  const f = fixture(t); f.apply();
  const report = checkHarness(f.root, true);
  assert.equal(report.status, 'failed'); assert.equal(report.documentation.status, 'incomplete');
  assert.deepEqual(report.documentation.topics.filter(row => row.status === 'missing').map(row => row.topic), ['development', 'testing', 'toolchain']);
  assert.ok(!report.documentation.topics.some(row => ['release','operations','environments'].includes(row.topic)));
});
test('combined existing source guides can cover selected topics with explicit nonempty sections', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, 'README.md'), '# Project\n\n## Setup\n\nInstall the locked project and run its local entry point.\n\n## Checks\n\nRun the declared smoke and tests using isolated local data.\n\n## Tools\n\nUse the checked-in runtime pin and lockfile.\n');
  f.spec.sources = [{ path: 'README.md' }];
  f.spec.document_coverage = [
    { topic: 'development', path: 'README.md', heading: 'Setup' },
    { topic: 'testing', path: 'README.md', heading: 'Checks' },
    { topic: 'toolchain', path: 'README.md', heading: 'Tools' }
  ]; f.apply();
  const report = checkHarness(f.root, true); assert.equal(report.status, 'passed'); assert.equal(report.documentation.status, 'covered');
  assert.equal(report.documentation.content_review, 'not attested');
  f.spec.document_coverage[1].heading = 'Missing'; f.apply(); assert.equal(checkHarness(f.root).status, 'failed');
});
test('heading-only guides, ambiguous sections and unsnapshotted authority cannot claim coverage', t => {
  const f = fixture(t);
  f.spec.documents.push(...['development','testing','toolchain'].map(topic => ({ path: `docs/harness/${topic}.md`, body: '# Empty' }))); f.apply();
  assert.equal(checkHarness(f.root).documentation.status, 'incomplete');
  f.spec.documents.at(-1).body = '---\ntitle: Placeholder\n---\nTools\n=====\n\nInstall\n-------\n\n<!-- still missing -->\n\n```sh\n```'; f.apply();
  assert.equal(checkHarness(f.root).documentation.topics.find(row => row.topic === 'toolchain').status, 'missing');
  f.spec.document_coverage = [{ topic: 'testing', path: 'untracked-guide.md' }];
  assert.throws(() => makeHarnessPlan(f.root, f.spec), /declared local source/);
  f.spec.document_coverage[0].path = 'docs/harness/index.md'; f.spec.document_coverage[0].heading = 'Repeated';
  f.spec.documents[0].body = '# Overview\n\n## Repeated\nFirst section.\n\n## Repeated\nSecond section.'; f.apply();
  assert.equal(checkHarness(f.root).documentation.topics.find(row => row.topic === 'testing').status, 'missing');
});
test('planned first-delivery commands remain pending until implementation is present and explicitly current', t => {
  const f = fixture(t); f.spec.documents[0].body += '\n\nAfter implementing the application, run `npm test`. It has not run yet.';
  f.spec.command_checks = [{ document: 'docs/harness/index.md', command: 'npm test', phase: 'planned', reason: 'The first-delivery guide creates package.json and its test before this step.' }];
  for (const topic of ['development','testing','toolchain']) f.spec.documents.push({ path: `docs/harness/${topic}.md`, body: '# Guide\n\nFollow the first-delivery procedure in the index; application work is still planned.' });
  f.apply(); const report = checkHarness(f.root);
  assert.equal(report.status, 'passed'); assert.equal(report.commands.find(row => row.command === 'npm test').status, 'pending');
  const invalid = structuredClone(f.spec); delete invalid.command_checks[0].reason; assert.throws(() => validateHarnessSpec(invalid), /require a reason/);
  f.spec.command_checks[0].phase = 'current'; f.apply(); assert.equal(checkHarness(f.root).status, 'failed');
  writeJson(path.join(f.root,'package.json'), { scripts: { test: 'node --test' } });
  assert.equal(checkHarness(f.root).commands.find(row => row.command === 'npm test').status, 'passed');
});
test('Markdown routes validate inline anchors and named references while ignoring fenced examples', t => {
  const f = fixture(t);
  const guide = '# Handbook\n\n## Setup\n\nFollow the local setup.\n\n## Setup\n\nAlternative setup.\n\n## 空仓计划\n\nA translated heading.\n';
  f.spec.documents[0].body = guide + '\n[Second setup](#setup-1)\n[Translation](#空仓计划)\n[Checks][run]\n\n[run]: #setup\n\n```md\n[Example](missing.md#missing)\n```';
  f.spec.document_coverage = ['development','testing','toolchain'].map(topic => ({ topic, path: 'docs/harness/index.md', heading: '空仓计划' }));
  f.apply(); assert.equal(checkHarness(f.root).status, 'passed');
  f.spec.documents[0].body += '\n[Bad anchor](#nonexistent)\n[Bad route][unresolved]\n'; f.apply();
  const errors = checkHarness(f.root).errors; assert.ok(errors.some(error => error.includes('Broken Markdown anchor'))); assert.ok(errors.some(error => error.includes('Unresolved Markdown reference')));
});
