---
name: harness-init
description: Initialize or refresh a repository or multi-repository AI harness from background and selected activities. Prepare tools, analyze project knowledge, and generate guides, Skills, commands, agents, rules, settings, hooks and CI for the selected local agents.
---

# Initialize or refresh a delivery workspace

Use the existing project and team conventions as the source of truth. Let the user choose the repositories and the depth of work per repository. Resolve work from the selected workspace or checkout, regardless of the current shell directory.

A request to initialize a repository's Agent environment means a usable repository
harness, not just a documentation exercise. Follow the [repository bootstrap](references/repository-bootstrap.md)
to derive native entry points and recurring workflows from that repository. Use a
documents-only scope when requested; an earlier rehearsal profile does not override
a later request for the real repository's complete configuration.

For an empty directory or a repository without application sources, first offer
**Harness documentation hub** (connect other repositories by Git URL or local
directory next) and **Monorepo** (add code to this repository later), with another
setup available as free text. Reuse an explicit role from the request or saved
background. Follow the [empty-directory branches](references/onboarding.md#empty-directory-role-selection)
before asking for an application description or stack; an empty directory alone
does not select application scaffolding.

For a new repository, prefer `harness.layout: "centralized"`: keep supporting
content in `.harness/`, use one regular `AGENTS.md`, and link `CLAUDE.md` to it.
Use `native` when the user selects native discovery, settings or hooks, or when
preserving an existing native layout. Save the same layout in the generation spec.
CI may be selected independently of the document layout. Centralized procedures are routed by the entry point; do not advertise them as
registered native Skills, slash commands or agents. A requested consolidation
authorizes relocating the selected harness files and updating their callers.

On initialization, present the documentation language choice before authoring:
English or Simplified Chinese. If the user has already chosen, state and reuse that
choice; do not silently infer it from repository prose. Save `profile.language`,
the workspace/member language and `spec.language` consistently. All future
AI-authored project documents belong in the chosen harness documentation root,
normally `.harness/docs/`; save `spec.documentation_root` and retain the generated
entry-point rule. After scanning existing documents elsewhere, show concrete
source/destination paths and ask which to move or keep before migrating them.
An initialization request alone does not select those existing documents for a move.

Name repository-local documents and workflows by purpose, without repeating the
repository or product name: `engineering`, `local-dev`, `verify`, `resume`,
`architecture.md`. Apply the same names to paths, frontmatter, invocation examples
and links. Add a component qualifier only to resolve an actual ambiguity in a
shared workspace. When correcting existing names, reconcile their callers,
generation spec, retired outputs and document-review paths together.

1. **Understand the intended work.** Read supplied background, existing entry points and an existing onboarding profile. Follow the [progressive initialization interview](references/onboarding.md): establish which development, testing, deployment and operations activities are wanted. Ask about platforms and environments only when relevant. Reuse explicit answers and confirmed repository facts; ask one or two focused questions at a time and continue independent inspection while waiting. A routine refresh reuses the profile and asks only about changed or unresolved needs.
2. **Discover and select.** Identify the current Git root and checkouts in the selected directories using [workspace selection and helper commands](references/workspace.md). For a coordinator repository, read its ignored `*.local.md` entry through the [shared local-context contract](references/local-context.md) and inspect its checkout bindings and linked repositories; scanning only its own directory may find no service source. Present candidates, branch/harness signals, alternate worktrees and limits. Establish stable member IDs and register/analyze/initialize modes. A user's explicit selection is sufficient. Review the plan's `document_consolidation` inventory and follow the [existing-document decision](references/documents.md#existing-documents-and-future-placement) before relocating any documents.
3. **Plan the harness.** Separate member enrollment/write scope, knowledge needed to answer the task, and authorized execution scope; an unselected dependency is an explicit boundary or gap, not an automatically enrolled/analyzed member.  Establish the target agent and desired artifacts using [complete harness generation](references/generation.md). For repository initialization, always populate the profile's `harness` choices; do not silently use the legacy document-only profile. Reuse supplied choices and existing configuration; a shared folder name alone does not establish which agent loads it. Build a task coverage table from the selected user questions, scope and confirmed sources. Use the [knowledge analysis](references/knowledge.md) and [document blueprint](references/documents.md) to derive task routes from real services, business flows and team constraints. Preserve the selected documentation root and entry-point symlinks. A central harness can keep guides and configuration in the coordinator while external members stay analyzed. Resolve an unanswered language choice before authoring final prose. Persist sanitized choices with `plan --profile`; keep missing facts pending.
4. **Prepare the selected tools and access.** Follow [toolchain preparation](references/toolchains.md) and only the relevant provider reference. Inspect first, then install missing tools when that setup is within the user's requested scope. Reuse an existing connector or project tool when selected. Honor inspect-only and documentation-only choices. Verify installation, authentication, target identity and the specific read access separately. A missing login or permission does not block drafting guides from confirmed sources. Keep actual deployment, infrastructure creation and operational mutations within their own requested scope.
5. **Generate and review.** For a legacy workspace, update generated consumers and custom locators before retiring the JSON map. Create or migrate one ignored local Markdown entry using the [local-context workflow](references/local-context.md), preserving user prose and checking tracked files before storing machine information.  Apply the registry plan, then author the selected source-backed content and explicit policies in a generation specification. Use `harness.mjs plan/apply` to preview and write native agent files, guides, bounded hooks and a CI gate. The [generation workflow](references/generation.md) covers existing-file reconciliation, optional components and member-local scope. Cover all selected documentation topics; map existing combined guides with `document_coverage`. Mark future first-delivery commands as planned with a reason. Preserve specialized existing workflows; artifact categories are choices, not a mandatory collection of boilerplate. After final edits, review generated documents with `--review-document ID PATH` using real symlink targets. Include implementation sources with `--source`; an inventory refresh does not acknowledge prose review.
6. **Verify and hand over.** Run workspace `check --local --strict` and generation `harness.mjs check --local` as applicable. Follow [command checks, doctor and source impact](references/verification.md): resolve missing topics, broken navigation and missing declarations, report affected outputs and projection drift, and run selected target-bound probes when execution is in scope. Replay representative task questions from the final entry point and separate structural checks, task knowledge coverage, actual execution, host activation and hosted delivery. A key answer requiring undocumented source discovery is a documentation gap. Exercise a representative journey from the final guides in an isolated checkout; record and correct assumptions needed by a fresh reader. Exercise hook cases and the detached CI checker, then follow the [agent activation checks](references/agent-targets.md) for the chosen installed host. Record artifact checks, host discovery/trust, hosted CI and application execution separately in the doctor report; file checks cannot establish native hook activation. Complete independent documentation even when login or host activation is pending. Use the [completion record](references/onboarding.md#completion-and-resume); when startup or testing is requested, run the established scenario and report its retained evidence.

Summarize selected members and actions, files changed, key open decisions, and any checks that need credentials or a real target. Keep machine paths, tokens, and sensitive output in their appropriate local systems.
