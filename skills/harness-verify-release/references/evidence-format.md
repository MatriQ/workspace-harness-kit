# Release evidence v1

Use `../scripts/evidence.mjs` with Node.js 24 or later to validate and evaluate
sanitized JSON records. It does not deploy, fetch evidence, run tests, approve a
release, or establish that an external reference is trustworthy. Source systems
and authorized project owners remain authoritative.

The bundled scripts include their parser dependencies and need no npm installation.

```sh
node "$SKILL/scripts/evidence.mjs" "$RECORD"
node "$SKILL/scripts/evidence.mjs" "$RECORD" --format markdown
node "$SKILL/scripts/evidence.mjs" "$RECORD" --workspace "$WORKSPACE"
```

Exit codes: `0` passed, `1` failed, `2` pending or invalid input. JSON distinguishes
`pending` from `invalid`. The complete output includes every check and attempt.
Markdown also retains attempt history. `--at` sets a fixed ISO 8601 evaluation time
for offline fixtures; ordinary verification uses the current UTC time.

## Contract

See the complete synthetic [example record](../assets/example-release.json):

```sh
node "$SKILL/scripts/evidence.mjs" "$SKILL/assets/example-release.json" \
  --at 2026-01-01T12:00:00Z
```

The sample is historical synthetic data, so it intentionally expires outside that
evaluation window. Do not copy its identities or outcomes into a real release.

| Location | Required fields |
| --- | --- |
| Record | `schema_version: 1`, `release`, `scope`, `observations`; optional `capability` |
| Scope | `target`, positive `max_age_seconds`, nonempty `components`, `journeys` |
| Target | `environment`, exact `identity` distinguishing account/service/channel |
| Component scope | `id`, expected `artifact`, `required_checks`, `not_applicable`, `criteria` |
| Journey scope | `id`, nonempty participating `components`, `criterion` |
| Observation | Exactly one `component` or `journey`; `check`, positive integer `attempt`, `status`, `target`, timezone-aware `observed_at`, `summary`, `evidence` references |

Every component classifies all four checks (`deployment`, `version`, `technical`,
`business`) as required or explicitly not applicable with a nonempty scope reason.
Version verification is always required. `criteria` maps every required check to
its expected outcome. Every declared journey requires a business observation.
Unknown fields and duplicate attempts are rejected to expose misspellings.

Observations use `passed`, `failed`, `pending`, or `not run`. Inapplicability comes
from the reviewed scope, not from an observation's self-exemption. An asserted pass,
failure, or skipped operation needs a short evidence reference. Use source record
IDs or credential-free URLs without query strings or fragments, never raw logs.

Version, technical and component business observations carry the identity actually observed or tested
in `artifact`. Journey observations carry `artifacts`, a map from each participating
component ID to the identity exercised. Missing comparable identities remain pending.
Tests from another build cannot prove the current component works.
Older v1 component business observations remain readable, but an asserted pass without
its tested artifact is now pending. Do not copy the expected identity into an old
observation; rerun the check or obtain its actual execution record.

An artifact has `kind`, `value`, and optional `platform`. Supported kinds are:

- `git_commit`: full lowercase 40- or 64-character SHA; proves declared source identity.
- `oci_manifest_digest`, `oci_index_digest`: `sha256:` plus 64 lowercase hex characters.
- `package_version`, `runtime_revision`: exact resolved identifiers, not tags or ranges.

Kinds and platform scopes must match before comparing values. A mapping between
different identity kinds must be established from trusted project metadata outside
the evaluator. See [artifact identity guidance](evidence-and-verdicts.md). Version 1
represents one expected identity per component. For staged rollouts, model each
required exposure group separately and obtain evidence covering its declared
replicas/traffic. A single healthy replica does not establish full-rollout coverage.

## Deterministic verdict

1. Required missing observations are pending; an empty scope is invalid.
2. A wrong observed target fails. Future or expired observations are pending.
3. A reported passing version, technical or component business check is compared with its expected artifact.
4. A reported passing journey must identify all participating expected artifacts.
5. A mismatched comparable identity fails; absent or incomparable identities are pending.
6. The highest attempt number is current. Timestamps must be nondecreasing across
   attempts. Earlier results remain visible and recovered failures are marked.
7. Any current failure makes the release failed. Missing, pending, or not-run
   required results prevent passing. Otherwise all required checks must pass.

`--workspace` resolves the record's `capability`, expands `requires` relationships,
and rejects omitted or unknown components. Run the workspace helper's `check` first
when available. This binding checks membership; environment policy, acceptance
criteria, and any approval still come from the project's reviewed scope.

## Read-only collectors

`../scripts/collect.mjs` outputs a single observation for insertion into the record's
`observations` array. A collector's exit `0` means collection succeeded, not that
the check or release passed. Exit `2` means collection could not establish a result.
Always evaluate the assembled record afterward. Preserve each attempt separately.

For pre-deployment decisions, use the separate [readiness evaluator](readiness.md).
For ECS runtime observations, use the [bounded AWS collector](aws-ecs.md).

### GitHub Actions deployment step

Use an existing authorized tool to export the specific
[workflow job](https://docs.github.com/en/rest/actions/workflow-jobs#get-a-job-for-a-workflow-run).
Keep that raw export local. Verify its run, attempt and actual deployment target.

```sh
node "$SKILL/scripts/collect.mjs" github-step \
  --input "$JOB_JSON" --step "Deploy API" --component api --attempt 1 \
  --target "$OBSERVED_TARGET_JSON" --observed-at "$OBSERVED_AT"
```

The exact step name must resolve once. A successful job with a skipped step becomes
`not run`. The target file contains the operation's verified `environment` and
`identity`; the exporter cannot infer either from a generic job payload.

### Runtime version endpoint

```sh
node "$SKILL/scripts/collect.mjs" version-http \
  --url "$VERSION_URL" --component api --attempt 1
```

The endpoint must return exactly `{target: {environment, identity}, artifact: {kind,
value}}`, with optional artifact `platform`. The adapter preserves the observed
target; it never substitutes the requested one. This is an anonymous GET with a
10-second timeout, no redirects, and a 64 KiB response limit. Authenticated platforms
should use their existing authorized tooling to produce the same observation format.
An application-declared revision still requires a trustworthy source-to-artifact
mapping when exact artifact verification is required.

### JUnit results

```sh
node "$SKILL/scripts/collect.mjs" junit \
  --input "$REPORT_XML" --component api --attempt 1 \
  --target "$TESTED_TARGET_JSON" --artifact "$TESTED_ARTIFACT_JSON" \
  --observed-at "$TEST_COMPLETED_AT"
```

The caller supplies the actual tested target, artifact and execution time from the
test runner. Failures/errors fail; skipped cases or incomplete counts remain pending;
an empty report is `not run`. The adapter intentionally does not promote partial
suite success to complete success. It emits counts and a report reference only.
