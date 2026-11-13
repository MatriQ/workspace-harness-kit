import { workspaceMain } from '../cli/workspace.js';
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) console.log('Usage: local-context --workspace PATH [--patch PATCH_JSON | --migrate] [--local-context FILE]\nReads the ignored Markdown entry. Updates preserve handwritten content and merge state objects.\nExit 2 means a missing binding or migration is pending; no login/startup readiness is implied.');
else process.exitCode = workspaceMain(['local', ...args]);
