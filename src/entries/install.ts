import { fileURLToPath } from 'node:url';
import { installMain } from '../cli/install.js';
process.exitCode = installMain(process.argv.slice(2), fileURLToPath(new URL('../', import.meta.url)));
