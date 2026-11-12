---
name: harness-test
description: Select and run a project's existing test suites for a change across one or more repositories. Use for local verification, regression, contract tests, end-to-end tests, and test results tied to the actual checkout or deployed version.
---

# Verify a change with tests

Produce a test result scoped to the changed behavior, the actual code or artifact tested, and the environment exercised. For post-deployment acceptance that also verifies the running artifact, use the release verification workflow.

1. Resolve the requested change and target. Use `.harness/workspace.json` and `.harness/workspace.local.json` when available to identify selected members and checkouts. Read the changed files and relevant repository instructions. For checkout tests record repository ID, commit, and whether the worktree has local changes. For deployed targets record the environment, account or service identity, and observed version when available.
2. Map affected interfaces to the consumers and suites that cover them. Use the project's actual scripts, test configuration, CI jobs, and workspace dependency evidence, including `consumes` and `validated_by` component relationships when declared. Start with the relevant repository checks. Add contract or integration tests for changed boundaries and an end-to-end case when the change affects a shared user journey. Include project-required gates for the requested workflow. Explain important coverage gaps and identify suites whose owners or locations are unknown.
3. Before execution, verify each suite's target, required services, credentials readiness, fixture data, and write effects. Use local or authorized test targets and test identities. Use per-run isolation where tests create or modify data. If a required service or authorization is missing, record that suite as pending and continue with independent checks within scope.
4. Run the native test entry points and capture their results. Record the suite, working directory or CI run, revision or deployed version, environment, relevant pass/fail/skip counts, and report location. Distinguish pre-existing failures using available baseline evidence. Identify a retry as a separate attempt and retain relevant failures when reporting a recovered or flaky check.
5. Summarize what passed, failed, remains pending, or was not run. For each failure, give the affected behavior and the shortest reliable way to reproduce it. Mark any inapplicable suite with a reason. Protect test data and credentials by quoting only the sanitized evidence needed to support the result.

A skipped job, a filtered-out case, and an unavailable test environment need separate explanations. Attribute each result to the member repository and exact target that produced it.
