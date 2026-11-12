import { fileURLToPath } from 'node:url';
import { workspaceMain } from '../cli/workspace.js';
import { evidenceMain } from '../cli/evidence.js';
import { installMain } from '../cli/install.js';
import { collectMain } from '../cli/collect.js';
import { onboardingMain } from '../cli/onboarding.js';
import { harnessMain } from '../cli/harness.js';
import { readinessMain } from '../cli/readiness.js';
const [command, ...args] = process.argv.slice(2);
const root = fileURLToPath(new URL('../', import.meta.url));
switch (command) {
  case 'harness': process.exitCode = harnessMain(args); break;
  case 'readiness': process.exitCode = readinessMain(args); break;
  case 'onboarding': process.exitCode = onboardingMain(args); break;
  case 'workspace': process.exitCode = workspaceMain(args); break;
  case 'evidence': process.exitCode = evidenceMain(args); break;
  case 'collect': process.exitCode = await collectMain(args); break;
  case 'install': process.exitCode = installMain(args, root); break;
  case '--version': process.exitCode = installMain(['--version'], root); break;
  case '--help': case '-h': case undefined: console.log('Usage: whk <workspace|onboarding|harness|readiness|evidence|collect|install> [arguments]\nUse whk COMMAND --help for details.'); break;
  default: console.error('Unknown command. Use whk --help.'); process.exitCode = 2;
}
