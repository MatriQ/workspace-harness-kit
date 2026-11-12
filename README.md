# Workspace Harness Kit

English · [简体中文](README.zh-CN.md)

**Initialize repository-specific Agent environments, then connect setup, testing and delivery evidence across repositories.**

Start from an empty directory, adopt an existing repository, or bring several repositories into a shared workspace. Product, design, engineering, QA, operations, marketing, business development, and support can follow the same repository, test, and release evidence.

## Skills

| Skill | What it does |
| --- | --- |
| [harness-init](skills/harness-init/SKILL.md) | Clarify background, repositories and platforms, prepare tools, and generate source-backed guides and native Codex / Claude Code configurations. |
| [harness-guide](skills/harness-guide/SKILL.md) | Find the right repository, runbook, owner, or delivery evidence from a natural-language task. |
| [harness-setup-local](skills/harness-setup-local/SKILL.md) | Check local prerequisites, use existing project commands, start the selected scenario, and run an application smoke check. |
| [harness-test](skills/harness-test/SKILL.md) | Select and run scoped checks across components, then record the tested environment, versions, and outcomes. |
| [harness-verify-release](skills/harness-verify-release/SKILL.md) | Evaluate pre-release readiness; verify deployment execution, the observed running artifact, technical smoke checks, and business acceptance. |

## Getting started

Install complete Skill folders in your agent's configured skills directory, or ask the agent to read the corresponding `SKILL.md` directly from this checkout. Helpers require Node.js 24 or newer; workspace discovery also requires Git. The committed `.mjs` bundles run without npm installation or a TypeScript compiler. Local setup and validation also require the target project's tools.

For a versioned installation, set `SKILLS_DIR` to the agent's configured directory and `INSTALL_PLAN` to a local temporary file:

```sh
node scripts/install.mjs --version
node scripts/install.mjs plan --destination "$SKILLS_DIR" > "$INSTALL_PLAN"
node scripts/install.mjs apply --plan "$INSTALL_PLAN"
node scripts/install.mjs check --destination "$SKILLS_DIR"
```

Review the plan before applying. Add `--skill harness-init` to install a subset. Re-run plan/apply from the desired checkout to upgrade. The installer copies supporting files, records versions and hashes, and refuses to overwrite unowned folders or local modifications. Reconcile those conflicts explicitly and create a new plan. It does not change agent settings or install global dependencies. See [installation and compatibility](docs/installation.md).

1. Start in an empty directory, a Git checkout, or a parent directory containing several checkouts.
2. Ask: **“Use harness-init in this repository to initialize a complete Codex and Claude Code environment. Derive project workflows, commands, agents, rules and guides from its sources. Cover development and testing; ask about deployment and operations when needed.”**
3. The agent presents the documentation language choice (English or Simplified Chinese), reusing an explicit saved answer. It then asks only what remains: needed activities, then relevant platforms (AWS, Azure, Google Cloud, other or multiple), services, environments and existing workflows. Local-only work skips cloud questions.
4. Select repositories individually or select all candidates from a directory and exclude specific entries. You can add external checkouts. Choose **register**, **analyze**, or **initialize** for each member, and central or member-local configuration. Select Codex, Claude Code or both, then the needed documents, Skills, commands, agents, rules, settings, hooks and CI.
5. Review the resolved scope, tool actions and proposed files. The agent inspects existing tools, installs missing ones within the requested setup scope, assists with login and verifies target access. You can choose inspection or documentation only. Existing authorization and preferences are reused.
6. The agent analyzes service boundaries and business flows, authors the selected procedures, generates the selected layout and checks the artifacts. It verifies host loading and trust in the actual agent session, and reports hosted CI and application execution separately. Continue with **“Use harness-guide to find the checkout flow and its release status”** or **“Use harness-setup-local to run the API and its dependencies.”**

Initialization inventories existing documents outside the selected harness documentation root and asks which to move or keep, with concrete paths and affected references. Saved per-document choices are reused; no helper moves documents automatically. Specialized Skills and entry-point symlinks retain their behavior.

New repository initialization prefers `layout: "centralized"`: one `.harness/`
directory for guides, workflows, rules and generator state, a regular `AGENTS.md`,
and `CLAUDE.md -> AGENTS.md` when Claude Code is selected. The entry point routes
work to the shared procedures; this layout does not register native Skills, slash
commands or agents. It rejects native settings, hooks and CI.

Repository-local documents and workflows use short purpose-based names such as
`architecture.md`, `engineering`, `local-dev`, `verify` and `resume`, without a
repeated repository-name prefix. Component qualifiers are used only when needed
to distinguish workflows in a shared workspace.

Choose `layout: "native"` when those host integrations are needed. Native mode uses
Codex `.agents/skills/` and `.codex/agents/`, Claude Code `.claude/`, and the existing
documentation layout. Existing specs without a layout keep native behavior. Both
modes write into the actual selected repository and validate their artifacts;
temporary rehearsals are reported separately. See the
[repository bootstrap workflow](skills/harness-init/references/repository-bootstrap.md).
Deployment and operations guides are included only when selected. Tool installation,
authentication, target access and application execution are reported separately.
Refresh reuses saved choices and handles missing or changed items. See the
[progressive initialization workflow](skills/harness-init/references/onboarding.md) and
[generation and native agent targets](skills/harness-init/references/generation.md).

This project is maintained in English and includes a Chinese README. Initialization explicitly offers English (`en`) or Simplified Chinese (`zh-CN`) for generated harness prose. An unanswered choice remains pending; refresh displays and reuses a saved choice. Existing documents retain their language and wording unless translation is requested. Legacy specs without a language retain their English renderer default.

For Chinese output, save `language: "zh-CN"` in both the onboarding profile and harness generation spec so managed entry-point instructions use Chinese on every refresh. Authored guides and descriptions follow the requested language; commands and identifiers retain their exact form.

The generated entry point requires all future AI-authored project documents—plans, designs, analyses, validation reports and handoffs—to live in the selected harness documentation root, normally `.harness/docs/`. Set `documentation_root` in the generation spec to match `documentation.root` in onboarding. Keep an index there and link to existing documents the user chose to retain elsewhere. Tool-required files keep their prescribed locations; this is an Agent instruction, not a filesystem permission boundary.

## Workspace helper

The workspace helper discovers Git checkouts, previews selections, persists the registry and local bindings, and checks the registry. The agent reviews sources and authors a generation specification; a separate generator renders and checks the selected native configuration. Both helpers run independently of the agent.

From the root of this repository, set `PROJECTS`, `WORKSPACE`, and `PLAN` to paths for your checkouts, an existing workspace directory, and a writable plan file.

```sh
helper=skills/harness-init/scripts/workspace.mjs
node "$helper" discover --directory "$PROJECTS" --depth 2
node "$helper" plan --workspace "$WORKSPACE" --language en \
  --member api init "$PROJECTS/api" \
  --member website analyze "$PROJECTS/website" > "$PLAN"
node "$helper" apply --plan "$PLAN"
node "$helper" check --workspace "$WORKSPACE" --local
```

Treat plans as local files. They can contain absolute checkout paths. The shared registry lives in `.harness/workspace.json`; the ignored `.harness/workspace.local.json` binds member IDs to machine-specific checkouts. Use an existing coordinator repository when the team wants to share the registry.

For background-driven initialization, save sanitized choices in a profile JSON:

```sh
node skills/harness-init/scripts/onboarding.mjs plan "$PROFILE"
node skills/harness-init/scripts/onboarding.mjs tools "$PROFILE"
node "$helper" plan --workspace "$WORKSPACE" --profile "$PROFILE" > "$PLAN"
```

Start a draft with `{"schema_version":1}` or adapt the
[synthetic AWS profile](skills/harness-init/assets/onboarding-aws.json).
`plan` reports remaining questions, tools and document topics; `tools` runs local
version probes. The agent performs installation, authentication and guide writing.
Workspace apply saves the profile as `onboarding`; omitting `--profile` preserves it.
Changed choices make prior document reviews pending. A complete plan is not evidence
that setup ran. Keep credentials and machine readiness in existing local stores.

For agent configuration, include `harness.targets` and `harness.artifacts` in the
profile. Adapt the [complete synthetic spec](skills/harness-init/assets/harness-complete.json)
using actual project sources and selected workflows, then set `SPEC` and `HARNESS_PLAN`
to the authored spec and a local preview file:

```sh
generator=skills/harness-init/scripts/harness.mjs
node "$generator" plan --workspace "$WORKSPACE" --spec "$SPEC" > "$HARNESS_PLAN"
node "$generator" apply --plan "$HARNESS_PLAN"
node "$generator" check --workspace "$WORKSPACE" --local
```

The preview includes exact file contents and conflicts. Apply preserves handwritten
entry-point text and merges supported settings; changed or unowned artifacts require
explicit reconciliation. A shared specification and ownership receipt live under
`.harness/`. Generated Node checks and literal command hooks run without the Kit or
npm dependencies. Optional GitHub Actions CI runs artifact and hook-case checks;
source-backed project commands can be added. An artifact check does not prove agent
activation or a hosted CI run. See [generation](skills/harness-init/references/generation.md)
for the schema, refresh behavior, native formats and activation checks.

When documents are selected, `check` requires nonempty coverage of the chosen activity
topics and checks local Markdown links, references and heading anchors. Existing
combined guides can use explicit `document_coverage` mappings. Coverage does not
attest factual accuracy; review sources and exercise the documented journey.

`check` also validates literal documented package scripts, Make targets and script
paths without executing them. Declare member/subdirectory command contexts explicitly.
Future first-delivery commands can be marked `phase: "planned"` with a reason;
they remain pending until implemented, reviewed and checked as current commands.
Unsupported or dynamic invocations also remain pending. Use the additional commands below
for source impact, read-only projection drift and layered execution evidence:

```sh
node "$generator" impact --workspace "$WORKSPACE" --local
node "$generator" sync --workspace "$WORKSPACE" --local
node "$generator" doctor --workspace "$WORKSPACE"
node "$generator" doctor --workspace "$WORKSPACE" --run-probe greeting-smoke
```

Doctor executes only individually selected probes from the reviewed specification.
It separates artifacts, native agent/hook activation, tools, target access, CI and
application smoke. Evidence expires and binds to the configuration and local mapping;
raw process output is not retained. Host activation requires actual session evidence.
Optional per-output provenance narrows impact reports; unmapped outputs retain
conservative dependencies. `sync` never writes members. See
[verification contracts and examples](skills/harness-init/references/verification.md).

After final document edits and source review, make a fresh plan with `--review-document api docs/harness/development.md`. Include project-specific source files with `--source api scripts/start.sh`. Then apply and run `check --local --strict`. Routine scans update source observations but preserve document review baselines; added sources and changed review inputs remain visible. A current fingerprint proves unchanged bytes since review, not that the documented commands ran. See [the review workflow](skills/harness-init/references/workspace.md#document-review-and-freshness).

Optional [components, capabilities, and typed relationships](skills/harness-init/references/registry.md) describe multiple deployable components in one repository. Startup and deployment ordering cycles are rejected. Members without explicit components keep a single implicit component.

## Release evidence

The release Skill includes a standalone Node.js evaluator for a versioned JSON record. It keeps expected scope separate from observations and checks target identity, artifact identity, freshness, required components, and attempt history:

```sh
node skills/harness-verify-release/scripts/evidence.mjs "$RECORD"
node skills/harness-verify-release/scripts/evidence.mjs "$RECORD" --format markdown
node skills/harness-verify-release/scripts/evidence.mjs "$RECORD" --workspace "$WORKSPACE"
```

Exit codes are `0` passed, `1` failed, and `2` pending or invalid. JSON distinguishes the last two. Missing observations, skipped deployments, and incomparable identities cannot pass. Component business checks now require the tested artifact, like technical checks; older v1 records remain readable but unbound business passes become pending. `--workspace` checks capability membership, including transitive `requires` relationships. Read-only collectors support a named step in an exported GitHub Actions job, a JSON runtime identity endpoint, JUnit reports and bounded AWS ECS runtime manifests. See [the evidence contract and collectors](skills/harness-verify-release/references/evidence-format.md).

Before deployment, use `whk readiness --plan FILE [--record FILE]`, or the standalone
`skills/harness-verify-release/scripts/readiness.mjs`, for project-specific artifact,
rollback, migration, monitoring and review evidence. It binds the exact target and
intended artifacts, retains retries and returns ready/not-ready/pending. It performs
no deployment and grants no permission. See [readiness](skills/harness-verify-release/references/readiness.md).

Project source systems still establish the truth and any required approval. The evaluator validates supplied evidence; it does not authenticate references, deploy, or approve a release.

## Examples and development

- [Synthetic multi-repository example](examples/README.md)
- [Workspace model, permissions, and evidence](docs/design.md)
- [Skill behavior exercises](evals/README.md)

The shared core is strict TypeScript, with separate filesystem, Git, HTTP, TOML, and XML adapters. Library consumers can import `evaluate` and `validateManifest`; the `whk` CLI uses the same implementation. See [Node architecture, packaging, and migration](docs/node-runtime.md).

From a source checkout, install development tools and run:

```sh
npm ci
npm run check:bundles
npm test
npm run check:examples
npm run check:evals
npm run check:package
```

The synthetic example requires Python 3.11+ and Git to run API, client, and worker components from independent repositories. It generates both hosts' configurations in a coordinator, verifies artifacts and hook cases, runs a real application smoke through doctor, and checks passing, healthy-old-version, skipped-deployment, and business-failure outcomes through the installed Node evaluator. The evaluation pack provides twelve isolated release scenarios and an assessor with comparison-campaign metrics; fixture tests do not count as agent runs or establish cross-model performance. Core tests use Node's built-in test runner and retain nine complete-result fingerprints from the previous Python evaluator.

Each target project supplies its deployment controls, credentials, and application-specific checks. Hosted deployment and acceptance outcomes must come from that project's actual environment.

See the [local documentation validation report](evals/harness-docs-validation.md)
for empty, existing-service and multi-repository author/consumer exercises, Node 24
replays, findings and the limits of structural document checks.

## License

[MIT](LICENSE)
