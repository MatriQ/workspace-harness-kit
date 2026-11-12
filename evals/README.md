# Skill behavior exercises

These exercises separate deterministic fixture checks from actual agent runs.
They do not call a model API, start another agent, or spend an inference budget.

```sh
node evals/run.mjs check-fixtures
node evals/run.mjs prepare healthy-old-version /path/to/empty-exercise
```

Start the agent under test in the exercise directory and give it `request.md`.
The directory contains the complete release Skill and synthetic input evidence;
it does not contain the assessor or expected verdict. Then assess its artifacts:

```sh
node evals/run.mjs assess healthy-old-version /path/to/exercise
```

Twelve scenarios cover complete evidence, a healthy old version, a skipped deploy,
business failure, a missing component, the wrong target, expired observations,
a recovered retry, incomparable artifact identities, and component business checks
with missing, wrong or correct tested artifacts. Source freshness,
document review conflicts, component relationships, and installation ownership
have deterministic regression tests in `tests/`.

The assessor checks the complete machine-readable result, retained attempt
history, unchanged input, and existence of a prose explanation. It does not grade
the explanation's accuracy or infer what tools the agent used. Review a sanitized
transcript for those dimensions. A passing fixture check is not a passing agent run.

For a comparison campaign, use identical scenarios, models, tool permissions,
evaluation time, and run counts for a baseline and each Skill version. Record the
agent and model version, Skill source digest, elapsed seconds, measured token usage,
cost when available, and human corrections in a local `run-metadata.json`.
Report false passes, evidence completeness, and failures as well as successes;
unknown cost remains unknown. Keep raw transcripts outside the shared repository.
No cross-model performance result is claimed by this repository.

Use `prepare SCENARIO DIRECTORY --skill-source /path/to/baseline-skill` to supply a
frozen baseline Skill folder while keeping the same current raw fixture and assessor.
The preparation output records a digest of the complete copied Skill. Keep each run
isolated and withhold the assessor, expected verdict and earlier conclusions from the
agent. Supply a fresh directory and agent context for every run.

`run-metadata.json` uses schema version 1 and requires `agent`, `model`, `variant`
(`baseline` or `candidate`), `skill_sha256`, nonnegative `elapsed_seconds`, measured
`input_tokens`, `output_tokens`, `cost_usd`, integer `human_interventions`, boolean
`smoke_executed` and a short `transcript_ref`. Use `null` for unavailable tokens/cost
or unreviewed smoke execution; never substitute zero for an unknown measurement.
Metadata asserts an actual run and needs a supervised transcript; the assessor cannot
authenticate that assertion. The Skill digest must match the copied Skill at assessment.

Create a local JSON list of `{scenario,directory}` entries, then run:

```sh
node evals/run.mjs campaign "$RUNS_JSON" > "$CAMPAIGN_REPORT"
```

The report includes complete-result matches, exact verdict matches, correct accept/block
decisions, false passes, smoke counts, human interventions,
time, tokens and cost for each variant, plus fixture/model matching. It refuses missing
metadata and duplicate run directories. Unknown measurements stay null. Matching
fixture/model labels does not establish equal hidden context, tool permissions or
statistical significance. Publish only sanitized summaries; retain raw transcripts and
machine paths locally. Unit tests of the campaign parser still count as zero agent runs.

The [component business binding campaign](business-binding-campaign.md) records six
actual independent agent runs with frozen baseline/candidate Skill snapshots. It is a
focused regression exercise, not a general agent benchmark.

The [local harness documentation validation](harness-docs-validation.md) records
three author/consumer handoffs, corrected guide replay on Node 24, and the empty,
existing-service and multi-repository workflows. Its six actual agent runs are
separate from the release comparison campaign and from fixture-only checks.

The [local Mori latency exercise](mori-latency.md) separates two independent agent
workflows from repeated helper and application-command measurements. It records
the local source-preservation checks, fixture setup failures and recovery, and
the limits of single-sample agent timing.

The [Mori functional rehearsal](mori-functional-rehearsal.md) continues that local
initialization through shared Swift tests, a native service build, disposable
startup and an exact replay of the generated runbook. It records the corrected
account-login assumption, cleanup and remaining host/business evidence boundaries.

The [Mori native repository bootstrap](mori-native-bootstrap.md) records initialization
in the actual target checkout: both host entry points, project Skills, explicit
commands, agents, rules and guides, plus real Codex Skill discovery and local checks.
The Mori reports are maintained in Simplified Chinese at the user's request.

The [Mori clean reinitialization](mori-clean-reinitialization.md) records removing
the existing Agent documents and configuration, regenerating from current sources,
and replaying the new local-startup guide against a freshly built candidate. It also
records the actual native/Web checks, cleanup and preserved task history.

The [Mori centralized layout](mori-centralized-layout.md) records consolidation into
one `.harness/` directory with a canonical AGENTS.md and a generated CLAUDE.md
symlink, including task-state migration, alias checks and the limits imposed by
concurrent application changes.
