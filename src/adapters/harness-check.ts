import { localContextEntry, localContextPath, MissingLocalContext } from './local-context.js';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { evaluateGuard, harnessConfiguration, harnessPath, renderHarness, validateHarnessSpec } from '../core/harness.js';
import { json } from '../core/json.js';
import { assertSelection, currentProfileHash, HARNESS_SPEC, readHarnessReceipt, sourcePath } from './harness.js';
import { fileHash, hash, readJson, resolvePath, stat, within } from './files.js';
import { checkCommands } from './commands.js';
import { harnessImpact, harnessSync } from './harness-impact.js';
import { checkDocumentCoverage } from './documentation.js';
import { markdownHasAnchor, markdownLinks } from '../core/markdown.js';

export function checkHarness(root: string, local = false) {
  root = resolvePath(root);
  const receipt = readHarnessReceipt(root);
  if (!receipt) throw new Error('No generated harness receipt');
  const errors: string[] = [], pending: string[] = [];
  const documents: Array<{ path: string; body: string }> = [];
  const spec = readJson(within(root, HARNESS_SPEC)); validateHarnessSpec(spec);
  const rendered = renderHarness(spec, { check: '', hook: '', notices: '', localContext: localContextEntry(root) });
  const configuration = harnessConfiguration(spec, rendered);
  const expected = new Set(rendered.map(artifact => artifact.path));
  try { assertSelection(root, spec); } catch (error) { errors.push((error as Error).message); }
  const recorded = receipt.files.flatMap(record => record.logical_paths);
  if (new Set(recorded).size !== recorded.length) errors.push('Repeated logical receipt entry');
  for (const name of expected) if (!recorded.includes(name)) errors.push(`Missing receipt entry: ${name}`);
  for (const name of recorded) if (!expected.has(name)) errors.push(`Unexpected receipt entry: ${name}`);
  const sourceKey = (source: { member?: string; path: string }) => json([source.member ?? null, source.path]);
  const expectedSources = new Set(spec.sources.map(sourceKey)), recordedSources = receipt.sources.map(sourceKey);
  if (new Set(recordedSources).size !== recordedSources.length) errors.push('Repeated source receipt entry');
  for (const source of expectedSources) if (!recordedSources.includes(source)) errors.push(`Missing source receipt entry: ${source.trim()}`);
  for (const source of recordedSources) if (!expectedSources.has(source)) errors.push(`Unexpected source receipt entry: ${source.trim()}`);
  for (const record of receipt.files) {
    try {
      const file = within(root, record.path);
      const expectedFile = rendered.find(item => item.path === record.path);
      if (record.symlink_target || expectedFile?.format === 'symlink') {
        if (expectedFile?.format !== 'symlink' || record.symlink_target !== expectedFile.content
          || !stat(file, false)?.isSymbolicLink() || fs.readlinkSync(file) !== expectedFile.content
          || record.sha256 !== hash(expectedFile.content) || !stat(file)?.isFile()) errors.push(`Entry-point symlink changed: ${record.path}`);
        continue;
      }
      if (spec.layout === 'centralized' && record.path === 'AGENTS.md' && stat(file, false)?.isSymbolicLink()) errors.push('Centralized AGENTS.md must be a regular file');
      for (const alias of record.logical_paths) if (resolvePath(within(root, alias)) !== resolvePath(file)) errors.push(`Alias changed: ${alias}`);
      if (!stat(file)?.isFile()) { errors.push(`Missing generated file: ${record.path}`); continue; }
      if (fileHash(file) !== record.sha256) errors.push(`Generated file changed: ${record.path}`);
      if (record.executable && !(fs.statSync(file).mode & 0o100)) errors.push(`Generated script is not executable: ${record.path}`);
      const content = fs.readFileSync(file, 'utf8');
      if (record.path.endsWith('.md') || (spec.command_checks ?? []).some(check => record.logical_paths.includes(check.document))) {
        for (const alias of record.logical_paths) documents.push({ path: alias, body: content });
      }
      if (record.path.endsWith('.json') || record.kind === 'ci') JSON.parse(content);
      if (record.path.endsWith('.toml')) parseToml(content);
      if (record.path.endsWith('.md')) {
        const links = markdownLinks(content);
        for (const label of links.unresolved) errors.push(`Unresolved Markdown reference in ${record.path}: ${label}`);
        for (const { destination: link } of links.links) {
          if (/^[a-z][a-z0-9+.-]*:/i.test(link)) continue;
          const [pathname, fragment] = link.split('#');
          const relative = path.relative(root, pathname ? path.resolve(path.dirname(file), decodeURIComponent(pathname)) : file).split(path.sep).join('/');
          if (relative.endsWith('.local.md')) { localContextPath(relative); continue; } // Declared optional machine resource, never a shared artifact.
          harnessPath(relative);
          const target = within(root, relative), info = stat(target);
          if (!info) errors.push(`Broken link in ${record.path}: ${link}`);
          else if (fragment && info.isFile() && relative.endsWith('.md') && !markdownHasAnchor(fs.readFileSync(target, 'utf8'), decodeURIComponent(fragment))) errors.push(`Broken Markdown anchor in ${record.path}: ${link}`);
        }
      }
    } catch (error) { errors.push(`${record.path}: ${(error as Error).message}`); }
  }
  if (currentProfileHash(root) !== receipt.profile_sha256) errors.push('Initialization choices changed since harness generation');
  for (const source of receipt.sources) {
    if (source.member && !local) { pending.push(`External source requires --local: ${source.member}/${source.path}`); continue; }
    try { if (fileHash(sourcePath(root, source)) !== source.sha256) errors.push(`Source changed: ${source.member ?? 'workspace'}/${source.path}`); }
    catch (error) { if (error instanceof MissingLocalContext) pending.push(error.message); else errors.push(`Source unavailable: ${source.member ?? 'workspace'}/${source.path}: ${(error as Error).message}`); }
  }
  const cases = (spec.hooks?.cases ?? []).map(example => {
    const actual = evaluateGuard(spec.hooks!.guards, example.input).decision;
    if (actual !== example.expected) errors.push(`Hook case failed: ${example.name}`);
    return { name: example.name, expected: example.expected, actual, status: actual === example.expected ? 'passed' : 'failed' };
  });
  const commands = checkCommands(root, spec, documents, local);
  for (const command of commands) {
    const message = `${command.document}:${command.line}: ${command.command}: ${command.reason}`;
    if (command.status === 'failed') errors.push(message);
    else if (command.status === 'pending') pending.push(message);
  }
  const synchronization = harnessSync(root, local);
  for (const row of synchronization.projections) {
    if (row.status === 'failed') errors.push(`Projection drift or unavailable file: ${row.target.member ?? 'workspace'}/${row.target.path}`);
    if (row.status === 'pending') pending.push(`Projection requires --local: ${row.target.member ?? 'workspace'}/${row.target.path}`);
  }
  const documentation = checkDocumentCoverage(root, spec);
  for (const topic of documentation.topics) if (topic.status === 'missing') errors.push(`Missing documentation topic ${topic.topic}: ${topic.path}: ${topic.reason}`);
  return { status: errors.length ? 'failed' : 'passed', scope: local ? 'artifacts-and-local-sources' : 'shared-artifacts', errors, pending, files: receipt.files.length, configuration, hook_cases: cases, commands, documentation, impact: harnessImpact(root, local), synchronization,
    activation: spec.targets.map(target => ({ target, status: 'not run', next_action: spec.layout === 'centralized'
      ? 'Verify that the target session loaded AGENTS.md (through its entry-point alias where applicable) and followed a linked procedure; native Skill/command/agent registration is not configured'
      : target === 'codex'
      ? 'Verify the installed Codex version, trusted project config, skill/agent discovery and /hooks trust in the target session'
      : 'Verify project settings, skill/command/agent discovery and hooks in the target Claude Code session' })),
    ci_execution: 'not run', application_execution: 'not run' };
}
