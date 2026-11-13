---
name: harness-test
description: Select and run a project's existing test suites for a change across one or more repositories. Use for local verification, regression, contract tests, end-to-end tests, and test results tied to the actual checkout or deployed version.
---

# Verify a change with tests

Produce a test result scoped to the changed behavior, the actual code or artifact tested, and the environment exercised. For post-deployment acceptance that also verifies the running artifact, use the release verification workflow.

1. Resolve the requested change and target. Use `.harness/workspace.json` and the ignored `*.local.md` entry named by `local_context` when available to identify selected members and checkouts. Read the changed files and relevant repository instructions. For checkout tests record repository ID, commit, and whether the worktree has local changes. For deployed targets record the environment, account or service identity, and observed version when available.
2. Map affected interfaces to the consumers and suites that cover them. Use the project's actual scripts, test configuration, CI jobs, and workspace dependency evidence, including `consumes` and `validated_by` component relationships when declared. Start with the relevant repository checks. Add contract or integration tests for changed boundaries and an end-to-end case when the change affects a shared user journey. Include project-required gates for the requested workflow. Explain important coverage gaps and identify suites whose owners or locations are unknown.
3. Before execution, verify each suite's target, required services, credentials readiness, fixture data, and write effects. Use local or authorized test targets and test identities. Use per-run isolation where tests create or modify data. If a required service or authorization is missing, record that suite as pending and continue with independent checks within scope.
4. Run the native test entry points and capture their results. Record the suite, working directory or CI run, revision or deployed version, environment, relevant pass/fail/skip counts, and report location. Distinguish pre-existing failures using available baseline evidence. Identify a retry as a separate attempt and retain relevant failures when reporting a recovered or flaky check.
5. Summarize what passed, failed, remains pending, or was not run. For each failure, give the affected behavior and the shortest reliable way to reproduce it. Mark any inapplicable suite with a reason. Protect test data and credentials by quoting only the sanitized evidence needed to support the result.

A skipped job, a filtered-out case, and an unavailable test environment need separate explanations. Attribute each result to the member repository and exact target that produced it.


Make the selection explicit: changed behavior → affected boundary → test layer →
expected decision. For relevant shared data, signature, callback, queue or region
switch changes, inspect both producer/provider and consumer sides. Use the task
coverage table and existing capability/relationship evidence; an uncertain dependency
is a coverage gap. Passing metadata/helper tests does not substitute for a business
regression or justify reporting an unavailable integration as passed. Write local
environment and per-attempt execution summaries to the common local context.

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
