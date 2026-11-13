---
name: harness-setup-local
description: Bring up an existing project's local development environment and prove a real startup path. Use when setting up a fresh checkout, starting selected services across a workspace, or diagnosing local prerequisites, configuration, or ports.
---

# Set up local development

Deliver a working local scenario or report the exact missing prerequisite and next action. A running process or container is an intermediate result.

1. Resolve the requested scenario and its repositories. In an initialized workspace, use `.harness/workspace.json` for member IDs and documented relationships and the ignored `*.local.md` entry named by `local_context` for checkout paths. Otherwise use the explicitly targeted checkout. Verify the Git root and relevant checkout revision before running project commands. Read each affected repository's instructions and use its current setup docs, manifests, lockfiles, and scripts as sources. If the request is for a new project with no runnable entry point, use the initialization workflow to prepare its setup guide or chosen scaffold.
2. Determine the minimum required components and their startup order. Use explicit component paths and `starts_after` relationships when available; descriptive `depends_on` or `consumes` links alone do not define startup order. Inspect the expected and installed runtime and package manager versions, required configuration names, service and database targets, and port ownership. Establish which prerequisites and services are already usable. For each missing item, identify its source and the supported setup action. Verify that local setup and fixture commands target local or explicitly authorized disposable data before running them.
3. Perform the in-scope local setup using the project's documented, locked dependency and startup commands. Create a missing local configuration file only from a project-owned example or a project-documented generation command. Preserve existing config and healthy dependencies. Confirm ownership before reusing a listener on an expected port. Use the project's supported override or report an occupied port if ownership is unknown. Keep runtime upgrades, global tool installation, shared config edits, and remote data changes within their separately authorized scope.
4. Run one documented smoke check that exercises the requested local behavior. For an API, use a representative request through the started app. For a worker, confirm that a controlled test input is processed. For a CLI or library, exercise a real command or consumer operation. State the expected result before the check and record the observed result. Distinguish a successful prerequisite or readiness check from a successful smoke check.
5. Report the selected repositories and revisions, their startup status, the smoke outcome, and any blocker with a next step. Use `passed`, `failed`, `pending`, or `not run` for each relevant check. When writing local status, use an established ignored location. If the project uses an ignored `AGENTS.local.md`, refresh its managed status block and preserve handwritten content. Refer to the workspace's existing checkout mapping rather than duplicating machine paths.

Record configuration names and readiness states. Keep raw environment dumps, credentials, connection strings, and unfiltered logs out of reports. Identify any services started during this run so later runs can reuse or stop them safely.

Reuse an initialization profile and the workspace's toolchain/environment guides
when present. Respect an inspect-only preference unless the current request changes
it. Recheck prerequisites and relevant access without repeating the full interview
or reinstalling compatible tools. Installing a cloud CLI or logging in does not
establish application startup or a passing smoke check.


Take the scenario and prerequisites from initialization's task coverage table when
available. State whether the proof uses complete dependencies, a fixture, or reused
dependencies and what remains unproven. Verify a representative request or controlled
task after startup; health alone is not the selected business behavior. Record each
process/container created by this run, owned/reused dependencies, smoke result and
cleanup command/outcome in the local entry. Do not stop a reused dependency merely
because this run is ending.

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
