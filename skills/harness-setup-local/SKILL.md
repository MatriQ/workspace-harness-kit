---
name: harness-setup-local
description: Bring up an existing project's local development environment and prove a real startup path. Use when setting up a fresh checkout, starting selected services across a workspace, or diagnosing local prerequisites, configuration, or ports.
---

# Set up local development

Deliver a working local scenario or report the exact missing prerequisite and next action. A running process or container is an intermediate result.

1. Resolve the requested scenario and its repositories. In an initialized workspace, use `.harness/workspace.json` for member IDs and documented relationships and `.harness/workspace.local.json` for checkout paths. Otherwise use the explicitly targeted checkout. Verify the Git root and relevant checkout revision before running project commands. Read each affected repository's instructions and use its current setup docs, manifests, lockfiles, and scripts as sources. If the request is for a new project with no runnable entry point, use the initialization workflow to prepare its setup guide or chosen scaffold.
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
