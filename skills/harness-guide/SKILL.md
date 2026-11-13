---
name: harness-guide
description: Find the right owner, repository, runbook, test, or delivery evidence from a product, design, development, QA, operations, marketing, business development, or support question. Use to answer where work belongs, how to validate it, or what is available in a given release or environment.
---

# Find the right delivery information

Start with the user's task. Infer the audience from the request when clear. For example, an availability question needs the product surface, release evidence, and communication eligibility; a local startup question needs a checkout and runnable commands.

1. Locate the workspace's `.harness/workspace.json` or use the explicitly selected repository. Use the ignored local binding when reading code on this machine. Read the relevant workspace and member guides before opening implementation details.
2. Map the question to the feature or component, environment, version, owners, and source records. Use declared `capabilities`, `components`, and typed `relationships` when present; members without explicit components use their member ID. Resolve owners and acceptance criteria through linked guides. Use only applicable sources available through existing access.
3. Use the [audience guide](references/audiences.md) to select evidence and present it in appropriate terms. Separate known facts, outdated observations, and pending checks. Keep commit, environment, release, and acceptance evidence separate. A registry mode is requested adoption scope, not completion. A document marked `current` is unchanged since review, not proof that its commands ran. Read release check and attempt details rather than inferring availability from an aggregate badge.
4. Return the answer, scope, source links, verification time when available, and the next action or owner if one is established. For an external audience, use information authorized for that audience. Use the project's source systems for any requested updates with existing authorization.

If several repositories are involved, explain which component holds each part of the answer and what is still pending across the dependency chain. Use the workspace evidence to route users to setup, testing, or release verification when they ask for an execution step.

When `onboarding` is present, use its selected activities and platform choices to
find the generated toolchain, environment and operational guides. These choices
record intended scope; obtain current installation, authentication and target access
evidence before asserting readiness. A new user request can extend the saved scope.


Use the task coverage table and evidenced capabilities to locate a business journey
before expanding a source search. Return the responsible implementation entry,
interface/data boundary, relevant condition and why that mapping answers the task.
When a guide lacks a key mapping, inspect authorized original material and identify
the documentation gap; naming a repository alone is not a usable answer. Update
shared documentation only within the current task's authorization.

## Machine-local context

Before work needing checkout paths, tool observations, port overrides, local service
addresses, CLI profiles or execution state, read the workspace registry's optional
`local_context` entry. Its default is `.harness/docs/workspace.local.md`; preserve an
established `AGENTS.local.md` or explicitly chosen `*.local.md`. The filename does
not imply automatic host loading. Use this Skill's bundled common helper:

```sh
node "$SKILL/scripts/local-context.mjs" --workspace "$WORKSPACE"
```

The helper validates the versioned JSON block, Git identity and ignore/tracking
status, resolving paths from the selected workspace, not the shell directory. A
missing binding is pending; supply the checkout using workspace plan/apply. Legacy
`.harness/workspace.local.json` is a read-only compatibility input. Use workspace
migration before maintaining local state; never double-write a JSON path map.

Write machine observations through `--patch "$LOCAL_PATCH"`, where the temporary
JSON patch contains the relevant `tools`, `environment`, `access`, `execution` or
`state` section. Keep one authority per value and preserve handwritten Markdown.
Tools still use their required `.env`, logs and JSON evidence formats; reference
those ignored artifacts from the local entry. Credential values remain in the
existing environment/keychain mechanism. Shared guides contain required versions,
configuration names and project defaults, not personal adopted values or readiness.
Reverify bindings and relevant observations after changing machine, checkout or
access target. Never copy another machine's successful startup/login/test state.
