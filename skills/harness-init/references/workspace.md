# Workspace selection and helper commands

Use the bundled `../scripts/workspace.mjs` with Git and Node.js 24 or later. No npm install or TypeScript compiler is needed. Execute it by absolute path if the current directory is a target workspace. The CLI reports JSON; show a short table to the user instead of dumping the raw plan.

## Discover candidates

```sh
node "$HELPER" discover
node "$HELPER" discover --directory "$PROJECTS" --depth 2 --repo "$EXTRA_REPO"
```

With no path options, discovery identifies the current Git root or scans the current ordinary directory. When adding other directories, pass `--repo "$CURRENT_REPO"` as well if the current checkout should also be a candidate. State the selected scan depth and exclusions. Use `--include-nested` when the user wants nested repositories included in directory discovery. If a repository has several checkouts, show them as alternatives and choose a binding explicitly. Submodule, sparse checkout, and missing-path findings need context before inferring absent project files.

## Plan and apply

Use the current workspace directory or an existing coordinator repository explicitly chosen to hold the shared registry. Use stable, readable IDs. Plan only the chosen members. A selection of all candidates applies to the discovery snapshot.

| Mode | Plan and workspace action | Member repository action |
| --- | --- | --- |
| `register` | Record membership, identity and binding. | No harness edits. |
| `analyze` | Inspect project sources and add a summary or links in the workspace. | No harness edits. |
| `init` | Analyze the project and plan its documentation. | Create or refresh selected documents after preview. |

```sh
node "$HELPER" plan --workspace "$WORKSPACE" \
  --member api init "$PROJECTS/api" \
  --member web analyze "$PROJECTS/web" \
  --member docs register "$EXTRA_REPO" \
  --language en --member-language docs zh-CN > "$PLAN"
node "$HELPER" apply --plan "$PLAN"
node "$HELPER" check --workspace "$WORKSPACE" --local
```

Omit language options on routine refresh to reuse configured values. A one-time prose language can be handled in the document plan. Keep `PLAN` in a local temporary location because it can contain absolute paths. Inspect the plan and any separate document changes before applying. The helper writes workspace metadata, including the ignore rule for local bindings. It leaves the selected member files to the Skill.

Add `--profile "$PROFILE"` to persist the sanitized JSON choices from the
[initialization interview](onboarding.md). The preview embeds the profile, and apply
uses that snapshot. Editing the original profile file requires a new preview to
include those edits. Omit the option to preserve existing choices; an explicit
profile replaces the whole `onboarding` object. Partial profiles are valid and retain
unanswered questions. This option does not install tools, authenticate or write guides.

The shared `.harness/workspace.json` stores member IDs, chosen modes, optional language overrides, document pointers and source fingerprints. The ignored `.harness/workspace.local.json` maps those IDs to this machine's checkouts. Write confirmed dependency relationships and useful references to the shared index. Personal paths belong in the local binding. Where the workspace root is itself a selected member, keep workspace metadata scoped under `.harness/`.

For each selected analyze/init member, the plan includes `document_consolidation`
with existing documents outside the chosen harness documentation root, content
fingerprints, saved keep/move choices and a pending question. Register-only members
are not scanned. The report distinguishes writable members and destination
collisions; apply rechecks the inventory but writes only registry metadata. Follow
the [document decision and migration workflow](documents.md#existing-documents-and-future-placement)
to ask about actual files, preserve decisions and execute only selected moves.

Use [the registry contract](registry.md) when adding independently released components,
typed relationships, or capability membership. Members without explicit components
have one implicit component with their member ID. An adoption mode records requested
scope, not evidence that initialization or execution finished.

## Relocate local checkouts

Resolve execution roots from `.harness/workspace.local.json` using
`checkouts[memberId].path`. A copied local manifest is machine state, not a portable
checkout map. After moving or copying a workspace, select the same member IDs and
modes with their new local paths and preview a fresh plan. For example, with the
installed workspace helper in `HELPER` and local paths in the other variables:

```sh
node "$HELPER" plan --workspace "$WORKSPACE" \
  --member api analyze "$NEW_API" \
  --member coordinator init "$WORKSPACE" > "$PLAN"
node "$HELPER" apply --plan "$PLAN"
node "$HELPER" check --workspace "$WORKSPACE" --local --strict
```

Repeat `--member` for every moved checkout, retaining its recorded mode. Planning
recomputes both `path` and `git_common_dir`, checks recorded remote identity and
preserves prior document-review records. Inspect the candidate checkout identity
before applying, especially for repositories with no remote. Do not manually change
only the path or follow stale Git-directory bindings. A plain rebind does not
acknowledge changed prose or sources. Local doctor evidence is bound to the old map
and needs a fresh observation after relocation.

## Document review and freshness

After writing and reviewing the final document bytes, create a second plan:

```sh
node "$HELPER" plan --workspace "$WORKSPACE" \
  --member api init "$PROJECTS/api" \
  --source api scripts/start.sh \
  --review-document api AGENTS.md \
  --review-document api docs/harness/development.md > "$PLAN"
node "$HELPER" apply --plan "$PLAN"
node "$HELPER" check --workspace "$WORKSPACE" --local --strict
```

`--source` is additive and persists member-relative source paths. Use it for scripts,
implementation entry points, and existing runbooks outside automatic detection.
`--review-document` is an explicit assertion that the caller completed the review;
never use it merely to clear warnings. It links the document and records its final
content hash plus the current member source inventory, excluding that document itself,
and the workspace onboarding profile when present.
All recognized member sources conservatively affect each review; per-section source
dependency mapping is not implemented.

Checks detect added, removed, and modified recognized sources. A plain `plan/apply`
updates the observation inventory while preserving old document review records.
Linked documents without a review baseline are pending for analyzed members.
Editing a reviewed document also makes it pending. Reverting exactly to reviewed
bytes and sources restores freshness; timestamps alone do not determine validity.
Changing initialization choices also makes previous reviews pending, including
reviews created before the first profile was recorded. Review the affected guidance
before acknowledging the new choices.
Write all selected documents before recording their baselines, including `AGENTS.md`,
so generated edits do not immediately invalidate their own initialization.

Without `--local`, only shared structure and workspace document links are checked.
`--strict` requires `--local` and fails on warnings as well as errors. Neither mode
executes project commands or establishes that the document's statements are true.

An empty ordinary directory can hold an initial registry with no members. Draft the new project guide there, then add the new checkout when it exists.

Apply uses an exclusive local lock and restores written metadata after an ordinary write failure. If a process is forcibly interrupted, confirm it has ended before removing `.harness/.workspace.lock`, inspect the shared and local registry, and create a fresh plan. The local checker reports inconsistent bindings so a selected member can be rebound deliberately.

A subsequent discovery is another read-only inventory. Present additions as candidates. A moved or unavailable checkout is a binding problem until the user decides to change membership. Re-run discovery and planning if the source checkout or shared registry changed.
