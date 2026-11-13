import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const check = process.argv.includes('--check');
const entries = {
  'src/index.ts': 'dist/index.js',
  'src/adapters/local-context.ts': 'dist/local-context.js',
  'src/adapters/workspace.ts': 'dist/workspace.js',
  'src/adapters/collect.ts': 'dist/collect.js',
  'src/adapters/install.ts': 'dist/install.js',
  'src/adapters/onboarding.ts': 'dist/onboarding.js',
  'src/adapters/harness.ts': 'dist/harness.js',
  'src/adapters/harness-check.ts': 'dist/harness-check.js',
  'src/adapters/harness-doctor.ts': 'dist/harness-doctor.js',
  'src/adapters/harness-impact.ts': 'dist/harness-impact.js',
  'src/adapters/readiness.ts': 'dist/readiness.js',
  'src/evals.ts': 'dist/evals.js',
  'src/entries/cli.ts': 'dist/cli.mjs',
  'src/entries/local-context.ts': 'skills/harness-init/scripts/local-context.mjs',
  'src/entries/workspace.ts': 'skills/harness-init/scripts/workspace.mjs',
  'src/entries/onboarding.ts': 'skills/harness-init/scripts/onboarding.mjs',
  'src/entries/harness.ts': 'skills/harness-init/scripts/harness.mjs',
  'src/entries/harness-check.ts': 'skills/harness-init/scripts/harness-check.mjs',
  'src/entries/harness-hook.ts': 'skills/harness-init/scripts/harness-hook.mjs',
  'src/entries/evidence.ts': 'skills/harness-verify-release/scripts/evidence.mjs',
  'src/entries/collect.ts': 'skills/harness-verify-release/scripts/collect.mjs',
  'src/entries/readiness.ts': 'skills/harness-verify-release/scripts/readiness.mjs',
  'src/entries/install.ts': 'scripts/install.mjs',
  'src/entries/evals.ts': 'evals/run.mjs',
};
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (pkg.version !== fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim()) throw new Error('package.json and VERSION must match');
const stale = [];
const bundled = new Map();
const builds = [...Object.entries(entries), ...['harness-guide', 'harness-setup-local', 'harness-test', 'harness-verify-release'].map(skill => ['src/entries/local-context.ts', `skills/${skill}/scripts/local-context.mjs`])];
for (const [entry, output] of builds) {
  if (check && output.startsWith('dist/')) continue;
  const executable = entry.startsWith('src/entries/');
  const result = await build({ absWorkingDir: root, entryPoints: [entry], outfile: output, bundle: true, platform: 'node',
    target: 'node24', format: 'esm', write: false, metafile: true, legalComments: 'inline', charset: 'utf8',
    banner: { js: (executable ? '#!/usr/bin/env node\n' : '') + '// Generated from TypeScript by scripts/build.mjs. Do not edit.' } });
  bundled.set(output, [...new Set(Object.keys(result.metafile.inputs).flatMap(input => {
    const match = /^node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(input);
    return match ? [match[1]] : [];
  }))].sort());
  for (const file of result.outputFiles) {
    if (check) {
      if (!fs.existsSync(file.path) || !fs.readFileSync(file.path).equals(Buffer.from(file.contents))) stale.push(path.relative(root, file.path));
    } else {
      fs.mkdirSync(path.dirname(file.path), { recursive: true }); fs.writeFileSync(file.path, file.contents);
      fs.chmodSync(file.path, executable ? 0o755 : 0o644);
    }
  }
}
// Parser licenses travel with copied Skills and the npm artifact, including transitive dependencies.
const licenseGroups = Object.fromEntries(['harness-init', 'harness-guide', 'harness-setup-local', 'harness-test', 'harness-verify-release'].map(skill => [`skills/${skill}/scripts/THIRD-PARTY-NOTICES.txt`, [...new Set([...bundled.entries()].filter(([file]) => file.startsWith(`skills/${skill}/scripts/`)).flatMap(([, dependencies]) => dependencies))].sort()]));
const notices = [];
for (const [output, dependencies] of Object.entries(licenseGroups)) {
  const sections = dependencies.map(name => {
    const folder = path.join(root, 'node_modules', name), meta = JSON.parse(fs.readFileSync(path.join(folder, 'package.json'), 'utf8'));
    const license = fs.readdirSync(folder).find(name => /^licen[sc]e(?:\..*)?$/i.test(name));
    const fallback = name === '@nodable/entities' && meta.version === '3.1.0'
      ? path.join(root, 'scripts/licenses/nodable-entities-3.1.0.LICENSE') : undefined;
    const licensePath = license ? path.join(folder, license) : fallback;
    if (!licensePath) throw new Error(`Missing license for ${name}`);
    return `${name} ${meta.version}\n${fs.readFileSync(licensePath, 'utf8').trim()}\n`;
  });
  const content = sections.join('\n'); notices.push(content);
  if (check) { if (!fs.existsSync(path.join(root, output)) || fs.readFileSync(path.join(root, output), 'utf8') !== content) stale.push(output); }
  else fs.writeFileSync(path.join(root, output), content);
}
if (!check) fs.writeFileSync(path.join(root, 'dist/THIRD-PARTY-NOTICES.txt'), notices.join('\n'));
if (stale.length) throw new Error(`Stale generated bundles: ${stale.join(', ')}. Run npm run build.`);
console.log(check ? 'Generated bundles match TypeScript sources.' : 'Built library, CLI, Skills, installer and evaluation runner.');
