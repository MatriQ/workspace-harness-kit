# Complete harness generation

Use this path when initialization includes agent configuration or when refreshing an
existing harness. The agent analyzes the project and authors the procedures; the
Node generator renders native files, previews changes, protects existing content
and checks the resulting artifacts. It does not infer business rules from filenames.

## Select the output scope

Set `harness.layout` and the spec's `layout` to `centralized` for one `.harness/`
directory, a regular `AGENTS.md`, and a generated `CLAUDE.md -> AGENTS.md` symlink.
Workflows are reached through the canonical entry point. Use `native` for native
Skills/commands/agents or selected settings/hooks. Omission remains `native` for
saved-spec compatibility; new initialization records its choice explicitly.

Infer the current agent and existing conventions, then resolve genuine ambiguity.
Record `harness.targets` (`codex`, `claude-code`, or both) and boolean choices under
`harness.artifacts`: `documents`, `skills`, `commands`, `agents`, `rules`, `settings`,
`hooks`, `ci`. Missing values are unanswered. Older profiles without `harness` retain
their document-oriented workflow. Do not add every artifact to a small repository.

Use the requested task and recurring workflows to select content:

| Artifact | Use when | Required content or decision |
| --- | --- | --- |
| Documents | Facts and commands need a stable home | Services, business flows, environments, setup/test/release/operations and source references |
| Skills | A recurring task benefits from progressive instructions | Specific trigger, applicable scope, procedure, evidence and failure handling; supporting resources where useful |
| Commands | A user wants an explicit repeatable entry point | Inputs, workflow and expected outcome; use explicit-invocation Skills on Codex |
| Agents | An independent assignment has a useful boundary | Delegation trigger, inputs, responsibilities, output evidence and handoff; permission inheritance stays visible |
| Rules | Standing project constraints need to accompany work | Scope, source, owner or established exception path; distinguish prose from enforcement |
| Settings | The team selected sandbox/approval or command policy | Host-supported settings; restrictive command prefixes with a reason; preserve existing policy |
| Hooks | A concrete pre-tool condition needs a supplementary guard | Literal command conditions and positive/negative cases; actual registration plus script, not an unconnected file |
| CI | The harness needs a repository check | Portable artifact/hook validation and any source-backed project check commands; actual repository controls remain separate |

Read [agent targets](agent-targets.md) before emitting runtime configuration. A native
hook can replace a proposed dependency on a plugin-specific hook format when that
plugin is absent. Preserve existing plugin workflows and their configuration.

## Author a generation specification

Use the [complete synthetic example](../assets/harness-complete.json) as a schema
example, not as domain content to copy. Keep the working spec and plan local until
their contents have been reviewed. The applied sanitized spec is shared at
`.harness/harness.json` so refreshes have one authored input.

Repository-local names describe the task or document, not its enclosing repository.
Use names such as `engineering`, `local-dev`, `verify`, `resume`, `reader` and
`architecture.md`; omit a repeated repository/product prefix. The containing
checkout already establishes that scope. Use a component qualifier only when
distinct procedures in one shared workspace would otherwise be ambiguous.
This convention does not rename the kit's globally installed `harness-*` Skills.
The renderer preserves authored names; it must not guess a prefix and strip it,
which could cause collisions or change an existing invocation contract.

For an authorized rename, preview a path/name mapping and check collisions first.
Preserve unique content and update frontmatter, links, command examples, source and
provenance references, and the specification. Back up and explicitly remove retired
owned outputs, regenerate, and reconcile workspace document/review paths. Preserve
historical task/evidence text as recorded. Check navigation and repeat generation
to ensure the old names do not reappear.

| Field | Contract |
| --- | --- |
| `schema_version`, `name`, `targets` | Version `1`, workspace title, selected supported hosts |
| `layout` | `centralized` or `native` (legacy default); centralized guides use `.harness/docs/`, resources use `.harness/resources/`, and native settings/hooks are rejected |
| `documentation_root` | Selected directory for all new AI-authored project documents; save it explicitly and match the onboarding root. Defaults are `.harness/docs` for centralized layout and `docs/harness` for native layout. Centralized roots may use a subdirectory of `.harness/docs`. Explicit roots constrain generated documents; existing source-only guides may stay elsewhere after the user's choice |
| `language` | Optional `en` (default) or `zh-CN` for generated entry-point instructions and routing labels; author document bodies and descriptions in the requested language |
| `sources` | Reviewed `{path}` workspace inputs or `{member, path}` inputs resolved through the existing local registry; no absolute checkout paths |
| `documents`, `resources` | `{path, body, executable?}`; documents contain final prose and relative source links, resources contain reviewed supporting files |
| `document_coverage` | Optional `{topic, path, heading?}` mappings to generated documents or declared local sources; topics are `index`, `development`, `testing`, `environments`, `release`, `operations`, `toolchain` |
| `skills` | `{name, description, body, resources?}`; resources are relative to the Skill folder and travel with both host outputs |
| `commands`, `agents` | `{name, description, body}`; write task-specific procedures and handoff contracts |
| `rules` | `{name, body}`; durable project guidance |
| `settings.commands` | `{prefix: [literal tokens], decision: "ask" or "deny", reason}`; native policies retain each host's scope and semantics |
| `settings.codex` | Explicit `sandbox_mode` (`read-only` or `workspace-write`) and `approval_policy` (`on-request` or `never`) |
| `settings.claude_code` | Explicit `defaultMode` (`default`, `plan`, `dontAsk`) |
| `hooks` | `guards` with `{id, contains_all: [literal command fragments], reason}` and `cases` with `{name, input, expected: "pass" or "deny"}` |
| `ci` | `provider: "github-actions"`, `checks: [{name, run, working_directory?}]`; an empty list still generates the harness integrity/hook gate |
| `command_checks` | Explicit `{document, command, member?, cwd?, phase?, reason?}` contexts; `phase` defaults to `current`; `planned` needs a reason and remains pending |
| `provenance` | `{output, sources:[{member?,path}]}` mappings; omitted outputs conservatively depend on all inputs |
| `projections` | `{source:{member?,path}, target:{member?,path}}` exact-copy declarations for read-only synchronization reports |
| `verification` | `max_age_seconds` and target-bound diagnostic `checks`; see [verification](verification.md) for probes and session evidence |

Paths are relative to the output workspace. Do not use generated outputs as their own
source inputs. Record actual implementation/workflow/runbook inputs and user decisions
instead. Missing facts remain explicit in prose; do not invent owners, resource names
or successful checks to complete a spec.

Present the language choice during initialization; reuse an explicit answer or saved
preference instead of silently defaulting. For a Chinese harness, save
`language: "zh-CN"` in onboarding, use `zh-CN` with the workspace/member language options and
set `language: "zh-CN"` in the generation spec. Translate the authored prose and
update any `document_coverage.heading` mappings together. The renderer does not
translate supplied bodies, command strings, identifiers or existing handwritten
instructions. Persisted specs retain the entry-point language on regeneration.

The renderer always adds a documentation-location rule to the managed entry point
in the selected language. It covers future AI-authored documents and the user's
choice before migrating existing documents. It is not an OS write restriction.
Generation rejects a language or documentation root that contradicts saved choices;
legacy specs retain their documented defaults and need an explicit root when
preserving a custom documentation directory.

The renderer creates paths for the selected layout, entry points, a generation receipt and
self-contained Node runtimes. Central generation runs against the coordinator. For
member-local configuration, create a scoped spec and plan for each member selected
in `init` mode. Analyze/register selections do not authorize member writes. Scope a
member's target/CI configuration to its actual responsibility.

## Preview, apply and refresh

```sh
node "$SKILL/scripts/harness.mjs" plan --workspace "$WORKSPACE" \
  --spec "$SPEC" > "$HARNESS_PLAN"
node "$SKILL/scripts/harness.mjs" apply --plan "$HARNESS_PLAN"
node "$SKILL/scripts/harness.mjs" check --workspace "$WORKSPACE" --local
```

Preview the plan's files, content, actions and conflicts. Apply rechecks source bytes,
profile choices, bindings, destination content and symlink resolution. It uses a lock
and rolls back ordinary write failures. Neither plan nor apply runs a generated hook,
CI check command, package installation or deployment.

Existing entry-point text is retained outside a dedicated managed block. An in-root
`AGENTS.md -> CLAUDE.md` or `.claude -> .codex` symlink stays intact. Escaping links
are rejected. Existing JSON arrays/objects are merged; differing scalar policy values
need reconciliation. Codex TOML additions use a managed block and retain surrounding
text. Existing permission-profile configuration needs a deliberate migration rather
than adding conflicting sandbox keys.

An existing custom file or an edited owned file produces a conflict. Read it, retain
the useful content in the proposed spec, and use `--adopt relative/path` for the exact
reviewed replacement when the requested update covers it. This is an explicit file
ownership decision, not a reason to request authorization already given. New edits
after preview invalidate that plan. Artifacts removed from the spec are reported for
deliberate reconciliation; they are not silently deleted or left unreported as active.
Retired generated JSON settings, including permission entries and hook registrations,
also remain conflicts until reconciled. Array merging never silently keeps a retired
generated policy while claiming it matches the new spec. Preserve unrelated settings,
remove only the retired values covered by the update, then preview with exact adoption.

After an interrupted process, confirm it is no longer running, inspect the output and
receipt, remove an abandoned `.harness/.generation.lock`, and preview again. Do not
remove another process's live lock. Preserve any concurrent edits reported during
rollback.

## Verification and handoff

`harness check` verifies receipt coverage, file bytes, executable scripts, JSON/TOML,
local Markdown links and heading anchors, selected documentation topics, literal command declarations, projection drift, current profile choices and source fingerprints. `--local`
also resolves external source members. Without it, external sources are explicitly
pending so a coordinator's CI does not pretend those checkouts were inspected.
Use [doctor, impact and sync](verification.md) for layered runtime evidence, precise
source dependencies and timestamped projection records. A pending command inspection
is reported explicitly; a successful artifact exit does not resolve it.

Documentation requirements follow explicit activity choices when the onboarding
profile selects `harness.artifacts.documents`. They use the configured documentation
root unless overridden by `document_coverage`; excluded activities are not required.
An empty document or missing/ambiguous mapped section fails. Existing profiles without
that selection retain their behavior; explicit mappings are still checked. The
`documentation` report separates coverage from unestablished content review and
execution. See the [document blueprint](documents.md) for the factual review and
first-delivery exercise that must accompany structural checks.

Hook cases exercise the maintained decision function. Also feed the cases through
the generated `.harness/runtime/hook.mjs` and inspect the native registration in the
target session. A non-matching case returns no permission decision; it never grants
access. Guards compare literal fragments of shell-tool text; they do not parse all
shell syntax or cover indirect writes through arbitrary programs. Keep host permissions,
sandboxing and project release controls in force. These guards are supplementary.

The generated GitHub Actions gate checks shared harness artifacts and hook cases.
Its YAML file uses JSON syntax, a YAML subset, and can be read with standard JSON
tools. It has read-only repository permissions, runs on PRs/pushes and is reusable
through `workflow_call`. Additional project commands must have the correct checkout,
runtime and dependencies. External repositories are not implicitly cloned. Configuring
required checks or organization rules and recording a real hosted run are separate
steps within the user's requested scope.

Report four results separately: generated artifact checks, agent activation, hosted
CI execution, and application/environment checks. Helper success establishes the
first layer. Use the [target checks](agent-targets.md) to finish or accurately retain
pending activation work. A previously installed agent or a new hook trust decision
cannot be inferred from a file's existence.

## Task coverage and optional local context

Derive authored procedures from the task coverage table: meaningful inputs, confirmed
preconditions, bounded steps, distinguishable results, evidence and failure handoff.
Keep shared service/data facts in one authoritative location; link task procedures
to it and map relevant `sources`/`provenance`. A directory of generic procedures is
not evidence of a usable workflow. Existing project collaboration remains authoritative.

Never include `*.local.md` as generated documents, resources, sources or projections.
The entry point references the selected local context as an optional machine resource;
shared checks do not require its presence. Local configuration owns its content and
uses the common parser, ignore check and migration workflow. CI can be explicitly
selected with centralized documents; settings/hooks still require native integration.
Artifact integrity, semantic handoff, real execution and hosted CI remain separate.
