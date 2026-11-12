# Registry contract: schema version 1

The additions below are optional and backward compatible with existing version-1
registries. The helper validates their structure; edit shared metadata through the
project's ordinary review workflow, then run `check`. A pre-existing plan becomes
stale when the registry changes. No source control operation is performed by the helper.

## Repository, component, capability

`members` continue to represent unique Git repositories. `components` describe
independently run or released parts of a member. A member without any explicit
components gets an implicit component whose ID is the member ID and whose path is `.`.
Explicit and implicit component IDs must not collide.

```json
{
  "schema_version": 1,
  "language": "en",
  "members": [{"id": "backend", "mode": "analyze"}],
  "components": [
    {"id": "api", "member": "backend", "path": "apps/api"},
    {"id": "worker", "member": "backend", "path": "apps/worker"}
  ],
  "relationships": [
    {"from": "worker", "to": "api", "type": "starts_after"},
    {"from": "worker", "to": "api", "type": "consumes"}
  ],
  "capabilities": [{"id": "greeting", "requires": ["api", "worker"]}]
}
```

Component paths are relative directories within their member. Local checks verify
that they exist and remain inside the checkout. Capability `requires` is a nonempty
list of unique component IDs. Optional owner and acceptance-source references may
remain in the human-readable index; the helper does not infer or verify ownership.

| Relationship | Direction | Semantics |
| --- | --- | --- |
| `starts_after` | Consumer to prerequisite | Startup ordering; cycles are rejected |
| `deploys_after` | Later deployment to prerequisite | Release ordering; cycles are rejected |
| `consumes` | Consumer to provider | Interface-impact information; cycles are allowed |
| `validated_by` | Component to validation component | Test or acceptance linkage |
| `requires` | Component to required component | Capability scope expansion during evidence evaluation |

`check` returns deterministic startup and deployment orders, including independent
components. These are partial-order linearizations, not executable startup commands.
Legacy member `depends_on` references remain accepted as descriptive relationships;
they are not used to infer execution order. Replace an ordering use with the
appropriate typed component relationship.

## Source observations and document reviews

Member `sources` holds the latest observed list of `{path, sha256}` entries.
`source_files` is an optional list of explicitly included member-relative files.
`documents` remains a list of member-relative links.

`document_reviews` holds independent records:

```text
path       A linked document's member-relative path
sha256     The document's final reviewed byte hash
sources    The reviewed member input snapshot: [{path, sha256}, ...]
onboarding_sha256  Optional hash of the workspace onboarding profile at review time
```

Only `plan --review-document MEMBER PATH` updates a review record. The document's
own path is excluded from that record's input snapshot. SHA-256 binds exact bytes,
including line endings; projects sharing review records across operating systems
should establish consistent text line-ending rules. Registering a previously analyzed
member preserves its review and source baselines.

`check --local` returns per-document `current` or `pending` results, reasons,
source warnings, component resolution, and orders. A missing checkout remains a
binding error. No current document status is asserted for an unavailable checkout.
`current` means unchanged since an explicit review, not executed-and-verified behavior.

## Initialization choices

Optional top-level `onboarding` stores a schema-version-1
[initialization profile](onboarding.md#record-answers-and-inspect-the-plan): sanitized
background, selected activities, platforms, tool policy, documentation placement and
optional `harness` target/artifact choices. The authored content lives separately in
`.harness/harness.json`; `.harness/generated.json` binds generated outputs and sources.
See the [generation contract](generation.md).
Missing choices stay unanswered; explicit `false` excludes an activity. Invalid
fields or values are rejected rather than silently ignored.

Use `plan --profile FILE` to replace the profile through a reviewed plan. Existing
registries without this field retain their behavior. `check` includes a derived
onboarding plan when the field exists; its `planned` status means choices are
complete, not that installation, authentication or documentation ran. Machine
readiness and local context names belong in ignored local state.

Document reviews include the profile fingerprint. A changed or newly introduced
profile leaves prior reviews pending until they are explicitly reviewed again.
The profile is workspace-wide, so this check conservatively affects all recorded
reviews rather than guessing which paragraph depends on a changed choice.
