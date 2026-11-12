# Design

Workspace Harness Kit links development, testing, deployment, and business acceptance across a user's selected repositories. It supports a single checkout and a directory containing several independent repositories. A team may use an existing repository to share the workspace index.

## Sources and scope

| Layer | Owns |
| --- | --- |
| Shared workspace | Stable member IDs, adoption modes, language preferences, sanitized initialization choices, document pointers, and confirmed dependencies. A human-readable index explains capabilities, owners, and where evidence is maintained. |
| Member repository | Runtime and framework, commands, architecture, configuration contract, engineering rules, tests, build and release controls. Reuse existing sources and handbooks. |
| Local workspace | Machine-specific checkout bindings and local readiness results. The ignored mapping is the source for checkout paths. An ignored local guide can link to it. |
| Delivery records | Requirements, PRs, build artifacts, deployment outcomes, observed runtime versions, test results, and acceptance decisions from their originating systems. |

The workspace helper previews repository selection and writes registry metadata. It leaves member documents to the initialization Skill, which previews each member's proposed changes. Apply only the selected scope. Resolve nested repositories, submodules, multiple checkouts, and missing bindings explicitly. Refresh discovers candidates without enrolling them.

Members represent repository identity. Optional components represent independently
run or released units within a member; capabilities declare required components.
Typed relationships distinguish startup/deployment ordering from interface and
validation links. Only ordering relationships require an acyclic graph. Existing
registries retain schema version 1 with these optional additions; see the
[registry contract](../skills/harness-init/references/registry.md).

Language is explicit. Repository documentation and Skill sources use English, with a Chinese README. Initialization presents English or Simplified Chinese and records the answer as onboarding `language`; an absent answer remains pending. Reuse an explicitly supplied or saved choice. The profile sets the workspace language, member overrides take precedence, and generation must match the effective choice. Legacy renderer inputs without a language retain English. Identifiers, commands, exact quotes, and existing text retain their original form.

## Progressive initialization

Initialization begins with the user's background and intended activities. Ask about
platforms and environments when deployment or operations is selected, then resolve
service-specific tools and existing workflows. Reuse supplied answers and confirmed
repository facts. A partial profile preserves unanswered choices; silence does not
exclude an activity. Documentation can live centrally while external members are
analyzed, or in selected initialized members.

The pure onboarding planner validates the profile and derives remaining questions,
tool requirements and guide topics. Its maintained tool adapter performs bounded
local version probes with fixed arguments, without shell evaluation. Custom tool
names are manual checks. The Skill performs OS-specific installation, authentication,
authorized target reads and writing, using current vendor instructions. Project
runtime constraints remain owned by repository sources.

Shared `onboarding` records intent. Local status records installation, authentication,
target access, documentation and requested execution separately. A saved installation
preference is not a grant of access on another user's machine. A complete plan or
available CLI does not establish login, resource access or a running application.
Refresh reuses choices and completes remaining work; new scope can revise the profile.

## Native harness generation

The primary repository initialization deliverable is a usable Agent environment in
the requested checkout. Reference harnesses inform capabilities, not copied business
facts or permissions. A documentation-only selection and an isolated rehearsal remain
distinct scopes. A later request for full initialization can revise the saved selection.
The Skill always records native harness choices for a new repository environment;
legacy profiles without them retain document-planning compatibility.

Initialization also selects target agents and artifact categories. Repository analysis
establishes service boundaries, business flows, environment ownership and recurring
tasks before authoring procedures. The agent creates a sanitized generation spec;
the pure renderer produces Codex and Claude Code native files. Documents, Skills,
explicit commands, agents, rules, settings, supplementary hooks and CI are independently
selectable. Central generation can use external members as sources without writing to
those repositories. Member-local generation is scoped to members selected for initialization.

The filesystem adapter previews complete contents, hashes inputs, preserves entry-point
text and in-root aliases, and merges supported settings. Existing conflicting or edited
files need explicit reconciliation. A generation receipt owns exact outputs and source
snapshots; a lock, pre-apply checks and rollback handle ordinary failures. Retired files
and generated settings are reported for deliberate reconciliation. The source spec and
receipt are separate from the workspace registry and its document-review records.

Checks distinguish artifact integrity, actual host discovery/trust, hosted CI execution
and application/environment results. The portable CI gate verifies shared artifacts and
hook cases; absent external checkouts remain pending. Literal command hooks supplement
host permissions rather than parsing or restricting arbitrary shell programs. Native
configuration can inherit host policy, and agent prose does not create a tool sandbox.
See [generation](../skills/harness-init/references/generation.md) and
[native target contracts](../skills/harness-init/references/agent-targets.md).

The artifact report includes a configuration inventory separating repository harness,
documents-only and entrypoints-only output, with exact paths for each artifact category.
Selected settings must produce native files for the selected hosts; an empty settings
object or settings for an unselected host cannot satisfy that selection. This inventory
describes output structure, not semantic quality or actual host activation.

Literal documented commands are checked against declared scripts, Make targets and
files, without evaluating shell or Make code. Explicit command contexts resolve
member/subdirectory ownership. Generated outputs can declare precise source mappings;
unmapped outputs remain conservative. Exact-copy projections have timestamped drift
reports and no automatic member writes. These declarations supplement the separate
workspace document-review baseline; they do not infer per-section code dependencies.

Doctor binds observations to the generated receipt and local checkout mapping,
retains retry history and rejects stale evidence. Only explicitly selected probes run.
Access/smoke assertions include the observed target, and artifact-bound probes include
the observed artifact. Host activation and native hooks require actual session
observations; supplied attestations are not independently authenticated. Probe output
hashes replace raw process streams. Missing runtime evidence keeps doctor pending
even when artifact checks pass.

## Repository documentation

Repository-local document and workflow names describe their purpose without
repeating the enclosing repository or product name. Keep paths, frontmatter,
invocations and references consistent. Component qualifiers resolve actual
ambiguity in shared workspaces; the kit's globally installed `harness-*` Skill
names remain stable. Renaming existing local outputs is an explicit migration,
not automatic string stripping by the renderer.

The generated entry point directs all future AI-authored project prose into the selected `documentation_root`, normally `.harness/docs/`; it matches onboarding `documentation.root`. This covers plans, designs, analyses, validation reports and handoffs. Host entry points remain concise routers, and required tool files retain their prescribed paths. The rule is guidance consumed by the Agent; it does not classify arbitrary future files by authorship or enforce filesystem writes.

Workspace plans inventory existing documents outside that root for selected analyze/init members and ask which to move or keep. Decisions persist per member and path in `documentation.existing_documents`. Candidate paths do not establish AI authorship. The bounded inventory excludes ignored files, dependencies, generated output, symlinks and host/Skill entry points. Apply revalidates the inventory but never performs a migration. The Skill presents source/destination paths, obtains the user’s choice, preserves contents, fixes references and checks final documents within the selected write scope. New discoveries remain unanswered even when earlier files have saved choices.

Generate a short `AGENTS.md` entry and link existing sources first. Add missing guides only where they answer recurring questions.

- Development covers runtime versions by context, dependency installation, configuration, service dependencies, startup, first smoke, debugging, and cleanup.
- Testing covers test tiers, execution directory and exact commands, CI gates, fixtures, isolation, expected outcomes, and report locations.
- Release covers environment identity, trigger and approval, build artifact, release and migration order, technical and business checks, observation, and rollback.
- Operations covers logs, metrics, alerts, dependencies, bounded investigation steps, expected signals and escalation. Toolchain and environment guides support the selected deployment or operations scope.
- Architecture and rules describe module or repository boundaries, data ownership, interface dependencies, and relevant constraints. Each constraint records its scope, source, and enforcement. Existing contribution or policy documents can own these topics.

Distinguish facts read from source files, results observed during execution, proposed decisions, and unresolved facts. Repository commands need their working directory, prerequisites, target, expected result, and source. Local secrets belong in existing credential stores or ignored configuration. Shared documentation records variable names and their purpose.

Source observations and document reviews have independent baselines. Re-scanning
updates what was observed, without claiming that derived prose was reviewed.
Explicit document reviews bind final document bytes to the member's current source
inventory and the workspace onboarding profile when present. Additions, removals,
modifications, malformed inputs, or changed initialization choices require review.
The initial implementation conservatively binds every review to all recognized and
explicit member sources, excluding the document itself. It does not infer per-section
dependencies or execute prose. A selected adoption mode is intent, not completion.

## Role-aware guidance

Route by task. A release can be queried by a developer, a QA analyst, a product owner, or a marketing lead using the same evidence. Show only information available under the source system's permissions. For an external audience, use information authorized for external use. Keep acceptance and publication decisions in their established systems.

## Release evidence

Record each required component separately. Capture the expected commit and artifact, deployment job and target, independently observed runtime identity, technical checks, business checks, and rollback evidence when applicable. Compare like artifact identities. Aggregate a capability only after evaluating each required component, the target environment, and applicable acceptance criteria. Each check can pass, fail, remain pending, be skipped, or be inapplicable with a reason.

Use synthetic test data for demonstrations. Collect only fields required to establish the outcome. Record references, timestamps, and observed status instead of copying full logs or response bodies. An observed technical result can inform a business decision. The designated owner supplies any separate approval required by the project.

The [evidence-v1 evaluator](../skills/harness-verify-release/references/evidence-format.md)
checks a separately declared scope against observations. It retains retry history,
compares like artifact identities, checks target and freshness, and produces JSON or
Markdown with deterministic verdicts. Technical and component business results must be tied to the artifact
actually tested. Cross-component journeys identify every participating artifact.
Missing or inconclusive evidence stays pending. The evaluator does not authenticate
source records or infer project approvals from a passing technical result.

Read-only collectors normalize a named GitHub Actions step, a runtime identity JSON
endpoint, JUnit results, and bounded AWS ECS running manifests after account verification. They remain with the release Skill and do not add
dependencies to workspace discovery. Authenticated retrieval and deployment remain
with the target project's existing tools.

Pre-release readiness is a separate exact-plan evaluation of artifact availability,
rollback, migration, monitoring and project review. Exclusions need scope reasons.
Changed artifacts or criteria invalidate prior evidence. Readiness grants no new
authorization and cannot substitute for post-deployment observations.

## Initial scope

Bundled Node.js helpers manage initialization plans and tool probes, native harness generation, workspace metadata, document freshness, evidence
evaluation, and explicit folder installation. Agent Skills guide source review,
documentation generation, local execution, testing, and evidence collection. Target
repositories supply application commands, release controls, and approval policies.
The synthetic example exercises three runnable components across five repositories.
Offline behavior exercises and artifact assessment are provided separately from live
agent runs; no model-quality or production-deployment claim follows from fixture tests.

The TypeScript core owns schema validation, native configuration rendering, bounded
hook decisions, component relationships, document freshness and evidence evaluation.
Adapters own filesystem, Git, HTTP,
TOML, and XML operations. CLI entry points format results and set exit codes.
Both library exports and independent Skill scripts are built from these sources;
there is one implementation of each rule. See [Node runtime and migration](node-runtime.md).

## Centralized repository layout

New initialization records `layout: "centralized"` in the profile and generation
spec unless native integrations are selected or an existing native layout is kept.
Centralized output consists of `.harness/`, a regular `AGENTS.md`, and a relative
`CLAUDE.md -> AGENTS.md` alias for Claude Code. Documents and authored resources
are confined to `.harness/docs/` and `.harness/resources/`; shared procedures,
delegation briefs and rules live in their generated `.harness/` subdirectories.
They are routed from the entry point and are not native command/Skill/agent
registrations. Settings, hooks and CI require `native` layout. Omitted layout
retains native behavior for existing profiles and specs.

Symlinks are explicit planned artifacts. Their target and file type are recorded,
checked before and after writes, and restored during ordinary transaction rollback.
A copied entry-point body cannot pass as an alias. Replacing existing custom text
requires reconciliation; consolidation preserves that text in the canonical entry
point and updates callers before retiring old locations. Mutable project task state
may share `.harness/` but remains outside generated receipts. Host evidence for
centralized mode concerns entry-point loading and following linked instructions,
not native discovery or hook registration.
