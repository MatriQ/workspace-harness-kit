# One machine-local Markdown entry

Use `.harness/docs/workspace.local.md` for a new workspace. Reuse an established
`AGENTS.local.md` or an explicitly selected `*.local.md`; keep a single authority
for each value. `workspace.json.local_context` optionally names the repository-relative
entry. It contains no adopted path, executable, profile, port or readiness state.
Generated entry points explicitly route relevant work to this optional resource.
It is not an automatic host-loading convention.

## Read and maintain

All five Skills distribute the same bundled `scripts/local-context.mjs` adapter.
Generated projects retain it as `.harness/runtime/local-context.mjs`, so project
locators and procedures use the same parser after the Kit is removed:

```sh
node "$SKILL/scripts/local-context.mjs" --workspace "$WORKSPACE"
node "$SKILL/scripts/workspace.mjs" plan --workspace "$WORKSPACE" \
  --local-context AGENTS.local.md --member api analyze "$API_CHECKOUT" > "$PLAN"
node "$SKILL/scripts/workspace.mjs" apply --plan "$PLAN"
```

The workspace helper validates Git identity and writes normalized bindings. Paths
in the managed input may be absolute, `~/...`, or relative to the selected workspace;
other environment substitutions and shell evaluation are unsupported. Use workspace
plan/apply to change a checkout. Run the common helper from any shell directory.
Selecting another entry does not silently duplicate an existing managed map: preserve
and reconcile the existing authority first. Only the designated, versioned
JSON fence is parsed; the complete local entry is bounded to 1 MiB. Link larger raw
reports instead of embedding them:

````md
<!-- workspace-harness-kit:local-context:start -->
```json
{
  "schema_version": 1,
  "checkouts": {},
  "tools": {},
  "environment": {},
  "access": {},
  "execution": {},
  "state": {}
}
```
<!-- workspace-harness-kit:local-context:end -->
````

The helper adds a machine fingerprint when writing. Tool observations, executable
locations/runtime manager selection, actual ports and addresses, Docker context,
proxy/certificate locations and local containers/data directories belong here.
Access records name personal CLI profiles/contexts and the time/scope of verification,
never token/password/private-key values. Use `execution` entries keyed by distinct
run IDs to retain startup, behavior, cleanup and failed/retried attempts. Link ignored
raw reports rather than copying their full contents.

To update selected state, write a temporary JSON object with the appropriate
`tools`, `environment`, `access`, `execution`, `state` or `onboarding_status` fields:

```sh
node "$SKILL/scripts/local-context.mjs" --workspace "$WORKSPACE" --patch "$LOCAL_PATCH"
```

Object fields merge with existing state and handwritten prose is preserved. Do not
create another manually maintained JSON checkout map. Tools retain required `.env`,
logs and JSON evidence files as ignored runtime artifacts. Shared guides retain
project-required versions, portable defaults, installation steps and variable names;
personal choices, readiness and execution summaries remain local. Additional topical
`*.local.md` files can be linked from the authoritative entry, without repeating values.

## Privacy, new checkouts and migration

Before writing, workspace apply installs and verifies `*.local.md` ignore rules and
rejects a local entry or old map already tracked by Git. An ignore rule alone cannot
hide a tracked file. Public templates use names such as `workspace.local.example.md`
and contain only placeholders. Local entries are excluded from discovery sources,
document migration inventory, shared generation artifacts/receipts and review baselines.
The shared artifact checker accepts the declared optional local entry being absent;
local operations report missing bindings as pending with a completion action.

Old `.harness/workspace.local.json` is read only when needed for compatibility and
migration. Before retiring it, inspect project locator resources and callers and
switch them to the common parser/runtime. For an existing generated Harness, first
refresh its saved spec using the new generator while the read-only legacy map is
still available. Workspace migration rejects an old generated consumer inventory
without the current local-context runtime and flags declared locator scripts still
mentioning the old JSON map. This bounded inventory checks managed artifacts, not the
semantics of arbitrary handwritten callers. Reconcile those callers explicitly.

```sh
node "$SKILL/scripts/harness.mjs" plan --workspace "$WORKSPACE" \
  --spec "$WORKSPACE/.harness/harness.json" > "$HARNESS_PLAN"
node "$SKILL/scripts/harness.mjs" apply --plan "$HARNESS_PLAN"
```

Then preview/apply the workspace or explicitly migrate:

```sh
node "$SKILL/scripts/local-context.mjs" --workspace "$WORKSPACE" --migrate
```

Migration checks actual checkout identity, merges nonconflicting fields into the
selected Markdown block, preserves original prose and writes recoverable copies
of the old JSON and any existing Markdown
under ignored `.harness/local-backups/` before retiring the old map. Conflicting
Markdown/JSON fields or malformed markers fail visibly; they never silently fall
back to a stale map. Inspect and reconcile those fields, then preview again. Existing
raw execution records stay in their original format and location.

Prior machine snapshots are retained in local machine history when readiness is reset.
After moving checkouts, rebind through the workspace helper and reverify affected
execution/access results. Copying local Markdown does not establish another machine's
readiness. Machine identity, actual Git directories/revisions and relevant local environment
are part of doctor binding; unrelated handwritten notes are not. A new checkout/CI
without local state can still check shared files, but cannot claim member execution,
provider login, host activation or application readiness.
