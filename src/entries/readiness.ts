import { readinessMain } from '../cli/readiness.js';
process.exitCode = readinessMain(process.argv.slice(2));
