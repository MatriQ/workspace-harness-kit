import { collectMain } from '../cli/collect.js';
process.exitCode = await collectMain(process.argv.slice(2));
