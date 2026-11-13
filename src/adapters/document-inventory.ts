import { isLocalResource } from '../core/local-context.js';
import path from 'node:path';
import type { OnboardingProfile } from '../core/onboarding.js';
import { WorkspaceError } from '../core/registry.js';
import { fileHash, stat, within } from './files.js';

const EXCLUDED = new Set(['.git', '.venv', '.build', '.swiftpm', '.worktrees', 'node_modules', 'vendor', 'target', 'dist', 'build', 'coverage', '__pycache__']);
const TOOL_DIRECTORIES = ['.harness/runtime/', '.harness/skills/', '.harness/commands/', '.harness/agents/', '.harness/rules/', '.harness/resources/', '.harness/state/',
  '.agents/skills/', '.codex/skills/', '.codex/agents/', '.codex/rules/', '.codex/hooks/', '.claude/skills/', '.claude/commands/', '.claude/agents/', '.claude/rules/', '.claude/hooks/', '.cursor/rules/'];
const ENTRYPOINTS = new Set(['agents.md', 'agent.md', 'claude.md', 'gemini.md', 'skill.md']);
export interface ExistingDocument {
  path: string;
  sha256: string;
  action: 'undecided' | 'keep' | 'move';
  destination?: string;
  destination_exists?: boolean;
}
export interface DocumentInventory {
  root: string;
  status: 'none' | 'needs-input' | 'reviewed' | 'moves-pending';
  member_writable: boolean;
  documents: ExistingDocument[];
  question: string | null;
  execution: 'not run';
  limits: string;
}

/** Inventory only: membership and a recorded choice never execute a migration. */
export function inspectExistingDocuments(root: string, member: string, listing: string, profile: OnboardingProfile | undefined, writable: boolean): DocumentInventory {
  const folder = profile?.documentation?.root ?? (profile?.harness?.layout === 'centralized' ? '.harness/docs' : 'docs/harness');
  const choices = profile?.documentation?.existing_documents ?? [];
  const documents: ExistingDocument[] = [];
  for (const relative of [...new Set(listing.split('\0'))].filter(Boolean).sort()) {
    if (isLocalResource(relative) || !/\.(md|markdown|mdx|rst|adoc)$/i.test(relative) || relative.startsWith(`${folder}/`)
      || relative.split('/').some(part => EXCLUDED.has(part)) || TOOL_DIRECTORIES.some(prefix => relative.startsWith(prefix) || relative.includes(`/${prefix}`))
      || ENTRYPOINTS.has(path.posix.basename(relative).toLowerCase())) continue;
    let file: string;
    try { file = within(root, relative); } catch (error) { if (!(error instanceof WorkspaceError)) throw error; continue; }
    if (!stat(file, false)?.isFile()) continue;
    const choice = choices.find(item => item.member === member && item.path === relative);
    const document: ExistingDocument = { path: relative, sha256: fileHash(file), action: choice?.action ?? 'undecided' };
    if (choice?.destination) {
      document.destination = choice.destination;
      document.destination_exists = !!stat(within(root, choice.destination), false);
    }
    documents.push(document);
  }
  const unanswered = documents.some(item => item.action === 'undecided');
  return {
    root: folder, member_writable: writable, documents,
    status: unanswered ? 'needs-input' : documents.some(item => item.action === 'move') ? 'moves-pending' : documents.length ? 'reviewed' : 'none',
    question: unanswered ? `Existing documents were found outside ${folder}/ in ${member}. After reviewing their purpose and proposed destinations, which should move into the harness and which should stay in place?` : null,
    execution: 'not run',
    limits: 'Git-listed Markdown/MDX/reStructuredText/AsciiDoc files only; ignored files, dependencies, build output, symlinks and host/Skill entry points are excluded. Filenames do not establish AI authorship. Destinations are member-relative; read-only members need an explicit scope change before a move.',
  };
}
