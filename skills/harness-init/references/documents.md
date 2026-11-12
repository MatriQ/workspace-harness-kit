# Repository analysis and document blueprint

Read existing agent instructions, contribution guides, build and test configuration, entry points, and infrastructure sources. Inspect enough implementation to name component responsibilities and real command boundaries. The helper's inventory is a starting point for the analysis.

## Existing documents and future placement

All new AI-authored project documentation, including plans, designs, investigations,
test reports and handoffs, belongs in the selected harness documentation root.
Use `.harness/docs/` for new centralized initialization, and persist the same root
in `profile.documentation.root` and `spec.documentation_root`. Keep the generated
documentation-location rule in AGENTS.md and its selected host entry points. Put
navigation in the entry point and maintain a topic index inside the documentation
root. Tool-required configuration, Skills and executable resources keep their own
locations; this rule concerns project prose, not machine runtime state.

Before writing the final guides, inspect `workspace plan`'s `document_consolidation`:

1. Review the listed files and their role. The bounded inventory includes Git-listed
   Markdown, MDX, reStructuredText and AsciiDoc outside the selected root. It excludes
   ignored files, dependencies, generated output, symlinks and host/Skill entry points.
   Legacy guide folders such as `.codex/docs/` and `.claude/docs/` are included;
   host runtime definitions and shared harness procedures retain their own locations.
   Inspect other formats or locations when repository conventions call for them.
   Filenames cannot prove AI authorship; a public README or product manual is not
   automatically an Agent document.
2. Show a short table of current path, proposed destination, purpose and affected
   links/build consumers. Ask whether to move selected documents, keep them in place,
   or decide individually. A previous explicit choice can answer this step. New
   discoveries require a choice; an empty choice list does not mean “move all.”
3. Record each choice in `documentation.existing_documents`. For example:
   `{"member":"api","path":"notes/design.md","action":"move","destination":".harness/docs/design.md"}`.
   Use `action: "keep"` without a destination for documents retained in place.
   The helper only records decisions; `workspace apply` never relocates documents.
   Member-relative moves require an initialized member, or the already selected
   output workspace. An analyzed external repository stays read-only; ask to change
   its scope if a selected move requires writing there. For a central coordinator,
   link external source documents unless a separate cross-repository migration has
   been explicitly selected and its source and destination scopes are established.
4. For selected moves, inspect source and destination again, retain a recoverable
   backup, and handle collisions before writing. Preserve content and original
   language unless translation was requested. Repair relative links, callers,
   literal paths, navigation and source declarations; do not leave duplicate bodies.
   Keep fixed host entry points and specialized Skills functional.
5. Review the final bytes, run link/source checks and relevant documentation build
   checks, then record document reviews. Report pending moves as pending, never as
   completed from a saved decision. For kept documents, link to their existing
   locations; new AI work documents still go inside the chosen harness root.

This is an Agent instruction and a bounded generation check. The kit cannot infer
authorship of arbitrary future files or enforce another Agent's filesystem writes.

| Subject | Evidence to inspect | Capture |
| --- | --- | --- |
| Stack and architecture | Runtime pins, dependency manifests and lockfiles, Dockerfiles, imports, routes, workers, and module entry points | Language, framework, package manager, version by local/CI/runtime context, component boundaries, external dependencies, and observable entry points. |
| Local development | Native task scripts, Compose, configuration examples, startup code, migrations, and fixture loaders | Working directory, prerequisites, install and startup commands, config names and origin, expected smoke result, debugging and cleanup. |
| Testing | Native commands, fixture setup, CI jobs, contract and end-to-end suites | Test tiers, fast and required checks, actual target environment, data isolation, report paths, and successful outcomes. |
| Release | Build scripts, workflow triggers, infrastructure declarations, and runbooks | Environment identity, deployment triggers and approvals, artifact identity, migration order, runtime evidence, smoke, business acceptance, and rollback. |
| Operations | Service configuration, observability dashboards, alerts, queue/database dependencies and incident runbooks | Authorized investigation targets, bounded log/metric queries, health signals, failure interpretation and escalation. |
| Constraints | Repository instructions, code ownership, team policy and CI protections | Requirement, scope, origin, enforcement location, and owner or documented exception process. |

Compare each source within its applicable context. If local, CI, and runtime versions differ, record the source of each. Record a conflict with both sources and a concrete way to resolve it. Label findings as observed in configuration, executed and verified, proposed, or pending. A workflow definition establishes its configuration; an execution result establishes what happened.

## Empty project

Establish the project type, known runtime and deployment choices, and the smallest useful behavior. If the user has not decided on a stack or hosting target, offer a suitable reference path and leave decisions visible. For selected development/testing, lead from an empty directory to runtime pinning, package and lockfile setup, a minimal runnable component, necessary configuration, and one behavior test. Include CI or a release rehearsal with rollback only when selected. Use project-type-appropriate checks, such as a CLI invocation, an HTTP request, a worker cycle, or installation in a clean consumer. Only record a real passing result when it ran.

Give complete contents or a confirmed generator for every file needed by the first
command. Create directories and a root `.gitignore` if absent; harness ignore rules
may instead live in `.harness/.gitignore` and must be preserved. Document stdout,
stderr and exit status consistently. Distinguish the requested runtime baseline
from a different compatible runtime actually used. Mark commands that depend on
future implementation as `phase: "planned"` with a reason in `command_checks`;
they remain unexecuted, not failed declarations or passing checks.

Include a concrete refresh handoff: once files exist, add the implementation,
manifest, lockfile and runtime pin to the generation spec's `sources`; change the
corresponding command phases to `current`; revise historical absence statements;
preview/apply with the installed generator; then register extra implementation
sources and review final guides through the [workspace review workflow](workspace.md#document-review-and-freshness).
Do not edit the generated receipt or acknowledge a review before reading the sources.

## Workspace and member guides

At the workspace level, index members by stable ID and describe confirmed capabilities, owners, dependencies, environment targets, and the sources used by different roles. For adoption in an existing project, link the files that already own each topic.

A minimal member harness may need only a brief `AGENTS.md` and links to existing documents. Where a topic is missing, use the following default locations or the repository's established equivalent.

- `docs/harness/development.md` covers installation through smoke, configuration, debugging, and cleanup.
- `docs/harness/testing.md` covers local and CI checks, test tiers, data, and reporting.
- `docs/harness/release.md` covers release paths, target and version verification, business acceptance, observation, and recovery.
- `docs/harness/architecture.md` or a rules document is useful when component boundaries or constraints need their own entry.

Use links to existing authority in preference to copying the same rule or command into several documents. For a generated portion of an existing file, use the paired markers `<!-- workspace-harness-kit:start -->` and `<!-- workspace-harness-kit:end -->` and preserve text outside the pair. If a document already has the original `repo-delivery` markers, update their existing section in place. Update content within a marked section only after verifying its ownership and expected contents. When modifying a new file's generated content, preserve any later user additions.

A command entry has a working directory, target, prerequisites, exact command, expected result, failure inspection entry, and repository source. A configuration entry has an environment, required flag, variable name, provider, and effect when missing. A release guide links to its workflow and observed run evidence. Keep placeholders explicit until a real source is available.

Name `.harness/workspace.local.json` and `checkouts[memberId].path` when routing to
members; do not make readers discover the ignored registry by trial and error.
Explain [rebinding after relocation](workspace.md#relocate-local-checkouts) when relevant.
Keep procedures reusable and execution records separately identifiable. A prior run
claim must have an accessible retained evidence reference. If evidence is not shipped
with a copied workspace, say it is unavailable there and give the fresh-run procedure;
do not present missing local artifact filenames as auditable proof.

After final edits and source review, record document baselines using the
[review workflow](workspace.md#document-review-and-freshness). Add scripts and
implementation sources outside the automatic inventory with `--source`.
Separate observed configuration, explicit document review, and executed checks.
Updating an inventory hash is not a substitute for updating or re-reviewing prose.

## Activity-driven guides

Use the onboarding plan as a topic checklist. Reuse established files and create
only missing guidance for selected activities; suggested filenames are not a fixed
template to copy wholesale. Keep existing specialized Skills and commands as the
authoritative procedure when they already cover a task.

| Selected scope | Suggested guide | Content needed to make it useful |
| --- | --- | --- |
| Every harness | `index.md` and a short agent entry point | System purpose, selected members/components, task-to-guide routing, sources and unresolved decisions |
| Development | `development.md` | Runtime pins, locked install, config sources, dependencies, startup, smoke and cleanup |
| Testing | `testing.md` | Test entry points, fixtures, affected scope, local/CI requirements, results and report paths |
| Deployment or operations | `environments.md` | Per-platform service, environment, account/subscription/project, region, access method and source for each identity |
| Deployment | `release.md` | Existing pipeline or manual trigger, artifact identity, ordering, approval controls, runtime verification and rollback |
| Operations | `operations.md` | Logs, metrics, alerts, dependency/queue checks, bounded investigation commands, expected signals and escalation |
| Any selected activity | `toolchain.md` | Required tools and why, supported versions, OS-specific official installation source, authentication/renewal and verification procedure |

When the profile selects documents, the checker requires nonempty coverage for
these selected topics. Default filenames follow `documentation.root`. If an existing
handbook combines topics or uses another name, declare `document_coverage` with
`{topic, path, heading?}`. The path must be a generated document or a declared local
source. A heading identifies one unique section by its rendered text. This checks
presence and routing, not whether the prose is accurate or sufficiently detailed.

Review source conflicts and every expected result, then exercise a representative
journey from the final guides in an isolated checkout when execution is authorized.
Use a fresh reader where available. Record any undocumented assumptions, missing
files, invalid commands, unexpected results, and cleanup effects. Fix the authored
spec, regenerate, review, and repeat affected steps. A link check or a topic count
alone does not establish an executable handoff.

Keep cloud account and resource identities in the project's established environment
documentation when appropriate. Keep tokens, credential values, personal CLI profile
names and machine readiness out of shared guides. Document how an operator chooses
an explicit context; keep the local binding in ignored state. Unknown identities,
owners or commands remain pending with their missing source. Never fill them with
plausible values and label the guide verified.

For example, a coordinator that selects AWS ECS deployment and CloudWatch operations
needs release and investigation routes, AWS CLI v2 setup, the selected pipeline
interface, environment identity and rollback guidance. It does not thereby need
Kubernetes, Helm or Terraform. Read service repositories and workflow definitions
to establish the actual commands. With an existing `.codex/docs/` tree, update its
matching guides and route from the existing entry point; preserve an
`AGENTS.md -> CLAUDE.md` symlink and edit its real target.

Generate project-specific Skills or commands only for confirmed recurring tasks
that benefit from executable guidance. Give each a focused trigger, applicable
repository/environment, prerequisite checks, source-backed actions, expected results
and failure handling. Link shared environment/toolchain guides instead of duplicating
them. A task router may point directly to a runbook when no extra Skill is needed.

Central guides can be reviewed under the coordinator member; external repositories
remain analyzed members. Check their source changes before reviewing central prose.
The helper binds a review to that member's sources and the workspace onboarding
profile; it does not infer cross-repository dependencies between prose sections.
Record the actual external source references in each central guide and include them
in the human review on refresh.
