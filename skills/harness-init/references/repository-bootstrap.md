# Initialize a usable repository Agent environment

Use this workflow when the user wants to initialize a repository or produce a
project-specific Agent environment comparable to an existing harness. The reference
repository supplies examples of capabilities and organization, not commands,
cloud resources, permissions or business rules to copy into the target.

## Resolve the actual destination and scope

Distinguish the invocation directory, reference repository and output repository.
Normally a request made in a repository targets that checkout. An explicitly named
destination takes precedence. Resolve the Git root and pass it to every helper;
never write to the Skill installation directory because that is the shell's cwd.
When several repositories are selected, retain their register/analyze/init modes.

Present the generated-document language choice at initialization, reusing an
explicit earlier answer. Save it in the profile, workspace and generation spec.
Before consolidating existing documents, show the discovered files and proposed
destinations and ask which to move or keep. The generated entry point must direct
all future AI-authored project documents into the selected harness documentation root.

A request to initialize the real repository authorizes writing its selected harness
files. A temporary rehearsal is useful validation but does not install those files.
Report the actual destination and apply the reviewed plan there. Rebind any local
registry when moving from a rehearsal; do not copy its local checkout map or claim
its runtime observations belong to a new binding.

For a new repository harness, set `profile.harness` and resolve its targets and
artifact choices from the request and source review. A document-only request stays
document-only. A later complete-initialization request can revise that earlier
scope. If an older profile lacks `harness`, the helper's legacy document planning is
not evidence that the user chose to exclude Agent configuration.

## Derive capabilities from real work

Present a compact capability plan instead of asking the user to choose eight
unexplained file categories. Reuse explicit host choices; both Codex and Claude Code
mean both native entry points. For each capability, establish its trigger, inputs,
authoritative sources, action, verification and failure handoff.

| Capability | Derive from | Useful output |
| --- | --- | --- |
| Locate the right component and guide | Architecture, actual entry points and user workflows | Short task router and a repository guide Skill |
| Implement a change | Existing engineering Skill, module boundaries and task checkpoints | A discoverable adapter to the established workflow, not a competing duplicate |
| Verify a change | Actual manifests, test suites, build scripts and target requirements | Test Skill and an explicit verification command |
| Start local development | Real setup, configuration, dependencies, smoke and cleanup | Local setup Skill with a source-backed runbook |
| Delegate a bounded investigation | A genuinely independent recurring task | Native agent definition with inputs and an evidence-based return contract |
| Preserve standing constraints | Existing project rules and data boundaries | Routed rules that cite or reuse the authoritative instructions |
| Release or investigate operations | Selected activities, environment and access evidence | Relevant workflows after the progressive platform interview |

Choose a small useful set rather than empty directories or filler procedures. Keep
instructions and descriptions in the requested language. Reuse existing guides and
Skills by linking them from native discovery adapters; preserve their ownership and
original wording. Model choice, permissions, cloud accounts, hooks and CI remain
explicit decisions. Do not invent settings merely to create a config file.

Use short task names within the repository: `engineering`, `local-dev`, `verify`,
`resume`, and `reader`. Do not prepend the repository or product name to local
documents, Skill folders, commands, agents or rules. Qualify only actual component
ambiguity in a shared workspace; preserve meaningful product names in prose.

## Choose the repository layout

Use `layout: "centralized"` for a new repository unless native integrations were
selected. Save this choice in both `profile.harness.layout` and the generation spec.
The centralized layout has one regular root entry point and one supporting directory:

```text
AGENTS.md                         Canonical instructions and task routing
CLAUDE.md -> AGENTS.md             Relative symlink for the selected Claude host
.harness/docs/                    Source-backed project guides
.harness/skills/                  Shared workflow instructions and resources
.harness/commands/                Named procedures, reached through AGENTS.md
.harness/agents/                  Delegation briefs, reached through AGENTS.md
.harness/rules/                   Shared standing guidance
.harness/resources/               Authored scripts and supporting files
.harness/                         Registry, input, receipts and checker
```

Only selected categories are generated. Keep all generated documents in
`.harness/docs/` and authored resources in `.harness/resources/`. This layout does
not register native Skills, slash commands or agents. It rejects settings, hooks
and CI rather than silently emitting nonfunctional configuration. Host activation
means loading the canonical entry point and following its linked procedures.

When consolidating an existing harness, first inspect ownership and callers and
resolve the [existing-document choices](documents.md#existing-documents-and-future-placement). Back up
the selected files outside the repository, relocate their contents, and update both
relative links and literal working-directory paths. Reconcile retired artifacts
explicitly. Keep mutable task state separate from generated files; if moving it under
`.harness/`, update its scripts and preserve all historical task objects. Replacing
an existing root entry file with a symlink must retain any unique instructions in
AGENTS.md. Do not create differently cased duplicate entry points.

## Opt into native discovery and integrations

Set `layout: "native"` and use the [current host contracts](agent-targets.md), not folder-name similarity.
A repository initialized for both hosts can contain:

```text
AGENTS.md                         Codex task router, preserving existing rules
CLAUDE.md                         Claude Code task router
.codex/agents/<role>.toml         Selected native Codex agents
.agents/skills/<workflow>/       Codex workflow and explicit-command Skills
.claude/agents/<role>.md          Selected native Claude Code agents
.claude/skills/<workflow>/       Claude Code workflows
.claude/commands/<command>.md    Explicit Claude Code commands
.claude/rules/<rule>.md          Claude Code standing guidance
.harness/rules/<rule>.md         Codex guidance linked from AGENTS.md
<existing-documentation-root>/  Source-backed project guides
.harness/                       Registry, authored spec, receipts and checker
```

`AGENTS.md` and `CLAUDE.md` are the canonical names; do not create an accidental
`AGENT.md` or differently cased duplicate. Native settings and hooks are added only
when selected with actual values and conditions. Preserve an existing in-root
`AGENTS.md -> CLAUDE.md` or `.claude -> .codex` alias, but do not manufacture a
shared directory to treat incompatible host formats as interchangeable.

Author the generation spec from the capability plan, preview it, and apply it using
[generation](generation.md). Save language and profile choices. Make all relative
links correct from the emitted native paths, including Skills nested several levels
below the repository root. Authored agent TOML instructions need source references
even though Markdown-link checking does not parse their strings.

## Verify the installed result

Check the selected capabilities against actual files and the checker's configuration
inventory. Every selected category needs usable content; a directory alone is not
completion. Run strict workspace review and the generated checker from the actual
target. Preview again from the saved spec to establish a repeatable refresh.

Follow a representative generated workflow, including its working directory and
target. Reuse still-applicable execution evidence without inventing a fresh run;
new target bindings need their own observations. Record actual host discovery and
trust separately from file checks. If a host is unavailable, deliver its validated
configuration and state the pending activation check.

The final handoff lists the destination, native entry points, discoverable workflows,
explicit commands, agents and rules actually installed. Explain deferred settings,
hooks, CI or access through their concrete missing decisions. Distinguish document
coverage, artifact integrity, host activation and application execution.
