# Pre-release readiness

Use this path before a requested deployment when the project needs a recorded
readiness decision. Keep it separate from post-deployment running-version and
business acceptance. Reuse the project's existing controls and authorization;
do not introduce another permission request when the session already covers the work.

Start with [the synthetic plan](../assets/example-readiness.json). Freeze the release,
target and exact intended artifacts. Choose required checks for artifact availability,
rollback, migration, monitoring and review. Classify each area as required checks or
`not_applicable` with a project-specific reason; artifact readiness is always required.
For example, a stateless local fixture can exclude schema migration, while a production
schema change needs compatible forward/backward steps and evidence for its recovery
strategy. Do not copy the fixture's exclusions into a real project without support.

```sh
node "$SKILL/scripts/readiness.mjs" --plan "$READINESS_PLAN" > "$READINESS_REPORT"
node "$SKILL/scripts/readiness.mjs" --plan "$READINESS_PLAN" \
  --record "$OBSERVATIONS" > "$NEXT_REPORT"
```

The first call emits the exact plan `binding` and pending checks (exit 2). Use different
input/output files. Each observation records `check`, positive `attempt`, `binding`,
`status`, `target`, `observed_at`, `summary`, short `evidence` references and `method`
(`attestation` or `probe`). Supply a `{schema_version:1,observations:[...]}` record or
a previous report with its nested `record`. Obtain observations from actual project
checks; a copied binding and invented summary are not evidence. No deployment, login,
rollback or migration is performed by the evaluator.

The decision is `ready` only when every required check has fresh positive evidence for
the exact plan and target; a failed check yields `not-ready`, missing/stale evidence
yields `pending`. Changed artifacts or criteria invalidate older bindings. Retried
checks preserve failures and mark recovery. Exit codes are 0 ready, 1 not-ready and
2 pending/invalid. This evaluates supplied evidence, not the authenticity of its
references or the authority to deploy. A readiness pass does not establish that the
deployment ran. After deployment, use the separate release evidence evaluator.
