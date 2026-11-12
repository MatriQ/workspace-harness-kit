# Node runtime and migration

The 0.2.0 source package uses Node.js 24+ for all harness helpers. Source code is
strict TypeScript; distributed commands are ESM JavaScript. `VERSION` and
`package.json` must agree. A source version does not imply an npm publication.

## Runtime choice

The project retains Node for its shared core. The CLI, generated checks, hooks and
typed library exports already share the same TypeScript implementation, and the
committed `.mjs` bundles run directly with Node. End users do not need npm,
development dependencies or a compiler; see [Node's ESM contract](https://nodejs.org/api/esm.html).

Python would be a reasonable alternative for an environment standardized on Python
with no Node runtime. Its standard library includes JSON, XML and filesystem tools,
and [TOML reading from Python 3.11](https://docs.python.org/3/library/tomllib.html).
A port would still need a supported interpreter, schema and output compatibility,
file ownership and recovery behavior, generated runtimes, and regression coverage.
It would also replace or bridge the current JavaScript library API. Installation
convenience alone does not justify that migration: `install.sh` now handles source
download, selection, installation and verification without changing the core runtime.

## Architecture

| Layer | Responsibility |
| --- | --- |
| `src/core/` | Initialization profiles, harness specification and native rendering, bounded hook decisions, evidence verdicts, registry validation, component ordering, document freshness and shared types. No filesystem or network access and no third-party imports. |
| `src/adapters/` | Filesystem and atomic writes, generation merging/ownership and artifact checks, Git discovery, local CLI version probes, installation recovery, HTTP probes, TOML manifests and JUnit XML. |
| `src/cli/` | Argument validation, JSON/Markdown output, exit codes. |
| `src/entries/` | Thin executable entry points. |
| `src/evals.ts` | Isolated behavior exercises and artifact assessment; no model invocation. |

`npm run build` bundles the library into `dist/`, emits TypeScript declarations,
and regenerates the standalone scripts in Skills, `scripts/`, and `evals/`.
Edit TypeScript sources instead of generated bundles. `npm run check:bundles`
compares the committed scripts and third-party notices without rewriting them;
CI runs it before rebuilding. Generated `dist/` files are not committed.

TOML parsing uses [smol-toml](https://github.com/squirrelchat/smol-toml); JUnit
parsing uses [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser).
Versions and transitive dependencies are pinned in the npm lockfile. These are
build-time inputs to self-contained bundles. End users do not install parser
packages, a compiler, or global dependencies to run copied Skills. Parser licenses
travel in `scripts/THIRD-PARTY-NOTICES.txt` inside each affected Skill and in `dist/`.

Workspace and installation operations use synchronous filesystem calls and bounded
Git subprocesses. The HTTP collector is asynchronous. Consumers embedding workspace
operations in a long-running server should isolate them in a worker or subprocess.

## Library and npm packaging

From a source checkout:

```sh
npm ci
npm test
npm run check:examples
npm run check:evals
npm run check:package
npm pack
```

`npm pack` builds a local archive. Install that chosen archive into a consumer
project; no registry release is assumed:

```sh
npm install /path/to/workspace-harness-kit-0.2.0.tgz
./node_modules/.bin/whk --version
./node_modules/.bin/whk workspace discover --directory "$PROJECTS"
./node_modules/.bin/whk evidence "$RECORD" --workspace "$WORKSPACE"
```

The archive includes `install.sh` and the complete Skills and can install them through
`whk install setup --agent codex` or `whk install plan/apply/check`. It has no runtime npm dependencies or install
scripts. `check:package` installs the archive offline in a temporary consumer,
exercises its CLI, library exports and declarations, installs Skills, removes the
consumer, then runs the detached Skill scripts. It also generates a complete harness
and verifies its runtime after removing both the package and installed Skills.

```ts
import { evaluate, validateManifest } from 'workspace-harness-kit';
import type { EvidenceRecord, EvaluationResult } from 'workspace-harness-kit';

// Values may come from JSON; both functions validate their inputs at runtime.
const result: EvaluationResult = evaluate(record, '2026-01-01T12:00:00Z');
const members = validateManifest(manifest);
```

The `record` and `manifest` variables above are caller-supplied JSON values.
`evaluate` returns a detached result and does not mutate its input. Invalid evidence
throws `EvidenceError`; the CLI translates invalid input to JSON and exit `2`.

Subpath exports separate operations:

| Import | Main functions |
| --- | --- |
| `workspace-harness-kit` | `evaluate`, `validateEvidence`, `compareArtifacts`, `markdown`, `validateManifest`, `componentModel`, `documentFreshness`, `checkWorkspaceScope`, contract types |
| `workspace-harness-kit` | `planOnboarding`, `validateOnboarding`, initialization profile and plan types |
| `workspace-harness-kit` | `validateHarnessSpec`, `validateHarnessSelection`, `renderHarness`, `evaluateGuard`, harness contracts |
| `workspace-harness-kit/onboarding` | `inspectToolchain`, using fixed local version probes or an injected `ToolProbe` |
| `workspace-harness-kit/harness` | `makeHarnessPlan`, `applyHarnessPlan`, generation plan/receipt types |
| `workspace-harness-kit/harness-check` | `checkHarness(root, local?)`, artifact and hook-case verification |
| `workspace-harness-kit/harness-doctor` | `harnessDoctor`, explicit bounded probe execution and configuration-bound evidence |
| `workspace-harness-kit/harness-impact` | `harnessImpact`, `harnessSync`, read-only dependency and projection reports |
| `workspace-harness-kit/readiness` | `evaluateReadiness`, exact-plan pre-release evidence |
| `workspace-harness-kit/workspace` | `discover`, `analyze`, `makePlan`, `applyPlan`, `checkWorkspace` |
| `workspace-harness-kit/collect` | `githubStep`, `junit`, asynchronous `versionHttp`, bounded read-only `ecsVersion` |
| `workspace-harness-kit/install` | `Installer(sourceRoot)` with `plan`/`apply`, `checkInstallation` |

`checkWorkspaceScope(record, manifest)` takes parsed registry data; the CLI owns
reading `.harness/workspace.json`. `applyPlan(plan)` accepts a reviewed plan object.
All timestamps must include a timezone; supported input uses a calendar date,
hours/minutes/seconds, optional one-to-six fractional digits, and `Z` or `±HH:MM`.
Counters must be safe integers in JavaScript.

`planOnboarding(profile)` accepts partial profiles and returns remaining questions,
tools and guide topics without side effects. `inspectToolchain(profile)` spawns only
maintained version commands, with a 10-second timeout per command and bounded output.
It returns parsed versions and statuses, not raw diagnostics. Unknown tool names
remain manual checks. Installation and provider login are agent-guided operations;
the helper does not execute package managers or cloud mutations.

Use `whk onboarding plan PROFILE_JSON` or the standalone
`skills/harness-init/scripts/onboarding.mjs plan PROFILE_JSON`. Add `--profile FILE`
to a workspace plan to persist the chosen scope. See the
[profile contract](../skills/harness-init/references/onboarding.md).

Use `whk harness plan --workspace DIR --spec FILE`, `whk harness apply --plan FILE`
and `whk harness check --workspace DIR --local` for native artifact generation.
The standalone equivalent is `skills/harness-init/scripts/harness.mjs`. Plans contain
exact proposed contents, conflicts and local paths. `makeHarnessPlan` reads bundled
runtime files; pure `renderHarness(spec, runtimes)` accepts their contents explicitly.
Apply rechecks the preview and handles ordinary write failure rollback. Checks verify
artifact/source fingerprints and hook cases without executing project CI commands.
See the [generation contract](../skills/harness-init/references/generation.md).

## Transition from the Python helpers

| Previous invocation | Current invocation |
| --- | --- |
| `python3 skills/harness-init/scripts/workspace.py …` | `node skills/harness-init/scripts/workspace.mjs …` |
| `python3 skills/harness-verify-release/scripts/evidence.py …` | `node skills/harness-verify-release/scripts/evidence.mjs …` |
| `python3 skills/harness-verify-release/scripts/collect.py …` | `node skills/harness-verify-release/scripts/collect.mjs …` |
| `python3 scripts/install.py …` | `node scripts/install.mjs …` |
| `python3 evals/run.py …` | `node evals/run.mjs …` |

Existing schema-version-1 workspace registries, review baselines, evidence records,
and installation receipts remain supported. Command arguments and verdict exit
codes remain the same. There is no Python forwarding shim: update scripts and CI
to call Node explicitly. Re-preview pending changes before applying them with a
new version.

The strengthened v1 evaluator also binds component business observations to the
tested artifact. Legacy records without that identity parse successfully but cannot
retain a passing business verdict. Obtain real execution evidence before adding the
missing field. See [verification](../skills/harness-init/references/verification.md)
for optional generation spec additions and [readiness](../skills/harness-verify-release/references/readiness.md)
for the independent pre-release contract. Documentation coverage follows explicit
profile choices; existing combined guides can map topics to declared source sections.
Planned first-delivery commands remain pending until promoted to current after
implementation. These optional schema-v1 additions do not attest prose accuracy or
execution. Doctor/ECS subprocess adapters are bounded
but synchronous; callers hosting concurrent requests should isolate them.

An installer-owned 0.1.0 installation upgrades using the normal reviewed
plan/apply flow. Complete-folder replacement removes old Python helper files and
installs the new bundles. Locally changed or manually installed folders still
require reconciliation; the installer does not overwrite them.

The Node test suite ports the original helper regression coverage and adds parser,
timestamp, packaging, and JavaScript-specific cases. Nine frozen complete-result
fingerprints in `tests/fixtures/python-v1-golden.json` were generated by the previous
Python evaluator, so compatibility checks do not compare the new implementation
only with itself. The migration also checked workspace discovery, plans,
cross-runtime plan application, drift results and installation against Python.
The Python implementation is not retained as a second runtime to maintain.

Only the synthetic target applications and their exercise launcher remain Python.
That exercise uses installed Node helpers against five independent repositories.
Local unit/integration checks do not establish hosted CI results, Windows support,
automatic agent selection, or production deployment acceptance.
