import { workspaceMain } from '../cli/workspace.js';
process.exitCode = workspaceMain(process.argv.slice(2));
