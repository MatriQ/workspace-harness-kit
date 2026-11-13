# Commands, diagnostics and source impact

Use this reference when validating an authored harness or refreshing one after project
changes. Artifact integrity, command declarations, native host activation, tool access,
application execution and release readiness are separate claims.

## Replay the document handoff

Choose questions representing selected tasks and consequential boundaries from the
task coverage table. Start from the final Agent entry point, follow its routes and
answer using the allowed documents/materials. Record the question, answer and cited
basis, source baseline, missing mappings, extra source searches/human interventions,
observed behavior and next action. If a key mapping must be rediscovered in source,
count it as a documentation gap, repair the guide and replay affected questions.
Do not count headings, file volume or a clean artifact check as semantic accuracy.

The author can replay first. When an independent reader is available and authorized,
give them the task, generated docs and permitted original material, not author
conclusions or expected answers. Keep model, permissions, inputs and evaluation time
conditions equal for baseline/candidate trials. Reuse the exercises in `evals/`;
fixture checks are not actual Agent trials. Record unknown time/token cost as unknown.

Report structural checks, task knowledge coverage, actual execution, host activation
and online delivery separately. Content review cannot replace doctor evidence.
Deliver independent completed material with explicit gaps; a workflow missing key
answers is pending, even if its files and metadata pass. Machine paths, readiness,
ports/profiles and execution summaries belong in the ignored local Markdown entry;
keep raw evidence in its required ignored format and link it locally. Share only a
sanitized summary. See [local context](local-context.md).

## Check documented commands

`harness.mjs check` inspects generated Markdown inline code and shell fences for
literal package `run`/`test`/`start` commands, Make targets and script entry points.
It reads `package.json`, Makefiles and referenced files without executing them.
Generated CI project commands are inspected with their declared working directories.
Missing declarations fail the artifact check. Quoting, substitutions, workspace
selectors, dynamic/included Make rules and unsupported invocations remain pending.
This is a bounded declaration check, not a shell interpreter or an execution result.
Commands outside recognized snippets still need source review.

Commands default to the output workspace root. Declare another context explicitly:

```json
{
  "command_checks": [
    {"document":"docs/harness/development.md","command":"npm run smoke","member":"api","cwd":"app"}
  ]
}
```

The command must occur in that generated document. Omit `member` for a workspace
subdirectory and omit `cwd` for the selected checkout root. Paths cannot escape a
checkout. `--local` resolves member contexts; shared CI reports them as pending.
Include the package manifest, Makefile or implementation file in `sources` so changes
to the command's implementation also invalidate the reviewed baseline. A declaration
check alone cannot establish what a package script does or whether it succeeds.

For an empty project, distinguish instructions for future implementation explicitly:

```json
{
  "command_checks": [{
    "document": "docs/harness/testing.md",
    "command": "npm test",
    "phase": "planned",
    "reason": "The first-delivery recipe creates package.json and the behavior test before this step."
  }]
}
```

The command must still appear in the document. A planned command is pending and is
not checked against absent implementation files. After implementing and reviewing
those files, set `phase` to `current`, add them to `sources`, regenerate, and execute
the selected test separately. Never mark a broken existing command planned to hide
an error. No phase value is execution evidence.

## Check documentation coverage and navigation

With documents selected in the onboarding profile, `check` requires an index and
nonempty guides for selected activities, including the supporting environment and
toolchain topics. See the [topic blueprint](documents.md#activity-driven-guides).
Map combined or pre-existing guides with `document_coverage`; for example
`{"topic":"testing","path":"README.md","heading":"Local checks"}` requires
that README as a declared local source and one nonempty `Local checks` section.
Default guide filenames need no mapping. Coverage is structural; the checker does
not attest the truth of the prose or an execution result.

Generated Markdown checks include local inline links, named reference links and
Markdown heading fragments. Unresolved explicit references and absent local anchors
fail. Fenced examples, inline code and HTML comments are excluded from link checks.
ATX/setext headings, repeated heading suffixes and explicit HTML anchor IDs are
supported. This is bounded inspection, not a full Markdown renderer; review dynamic
site routing and unusual markup separately. Source-only guides are fingerprinted
and checked for their mapped content, not recursively crawled.

## Diagnose the selected workspace

```sh
node "$SKILL/scripts/harness.mjs" doctor --workspace "$WORKSPACE" > "$REPORT"
node "$SKILL/scripts/harness.mjs" doctor --workspace "$WORKSPACE" \
  --record "$REPORT" --run-probe greeting-smoke > "$NEXT_REPORT"
```

Use different local files for input and output; shell redirection to the input would
truncate it. Reports can be supplied again through `--record`; the nested `record`
preserves attempts. Keep reports outside version control. Exit codes are 0 passed,
1 failed and 2 pending/invalid. Without `--run-probe`, doctor only inspects files and
supplied evidence. Review the reported argv, target and criterion before selecting a
probe under the existing task authorization. Selecting a probe executes that exact
argv without a shell; an explicitly selected shell executable or project script can
still perform its own operations. Doctor is not a sandbox.

The optional spec field `verification` contains `max_age_seconds` and `checks`:

```json
{
  "verification": {
    "max_age_seconds": 3600,
    "checks": [{
      "id": "greeting-smoke",
      "layer": "smoke",
      "target": {"environment":"local","identity":"greeting"},
      "artifact": {"kind":"package_version","value":"1.0.0"},
      "criterion": "The selected application version returns an accepted greeting",
      "probe": {
        "argv": ["node","scripts/smoke.mjs"],
        "timeout_seconds": 30,
        "expect_json": {
          "target": {"environment":"local","identity":"greeting"},
          "artifact": {"kind":"package_version","value":"1.0.0"},
          "accepted": true
        }
      }
    }]
  }
}
```

Check fields are `id`, `layer` (`tool`, `access`, `smoke`, `ci`), `target`, `criterion`,
optional `artifact`, `platform` and `probe`. A probe supports literal `argv`, a 1–60
second timeout, optional `member`/`cwd` and `expect_json`. Expected JSON is a subset
of the returned object; arrays match exactly. Access/smoke probes must assert the
observed target, and artifact-bound probes must assert the observed artifact. A
zero exit alone cannot establish these claims. An access check's `platform` names
its saved onboarding platform ID; use an actual account/subscription/project in its
target. CLI version checks establish only tool execution, not login or permissions.
Include probe implementation/configuration in `sources`. Never embed credentials in
argv, expected JSON, shared specs or evidence summaries.

Doctor automatically requires selected-host activation, native hooks when generated,
tool and smoke evidence, CI when generated and access for configured tool platforms.
Undefined tool/smoke/access checks stay pending; define the relevant project probes.
Pure hook cases and direct hook process tests remain artifact evidence. They cannot
pass the separate native hook layer. Follow [host activation](agent-targets.md) and
record actual session observations. Do not invent activation from version output.

Each observation has `check`, positive `attempt`, the report's exact `binding`,
`status` (`passed`, `failed`, `pending`, `not run`), `target`, optional `artifact`,
`observed_at`, a bounded `summary`, `evidence` references and `method` (`attestation`
or `probe`). Native agent/hook checks require an attestation from the actual session;
CI needs an actual run reference. Supplied attestations are not authenticated by this
helper. The configuration receipt and local checkout mapping bind observations;
source/artifact drift also fails the inspection. Stale/future observations cannot
pass. Retry attempts retain earlier failures. Probe stdout/stderr are bounded and
only their hashes are retained. Store any necessary sanitized evidence in the team's
existing evidence system, then cite it.

## Explain changes and projection drift

```sh
node "$SKILL/scripts/harness.mjs" impact --workspace "$WORKSPACE" --local
node "$SKILL/scripts/harness.mjs" sync --workspace "$WORKSPACE" --local > "$SYNC_REPORT"
```

`provenance` maps a generated logical `output` path to a list of declared `sources`.
Use it for per-document dependencies. Unmapped outputs conservatively depend on all
sources; the report marks which rule was used. Explicit mappings are authored claims,
not inferred code dependencies. Include command declarations and upstream runbooks
that actually support the output. An empty mapping means no source dependency and
needs a deliberate justification in the authoring review.
Changed onboarding choices conservatively affect every generated output.

`projections` declares exact copies as `{source:{member?,path}, target:{member?,path}}`.
The source must be a declared authoritative input. `sync` compares current byte hashes
and emits a timestamped record; it never writes either side. It is appropriate for
whole-file projections, not managed blocks or hand-edited adaptations. Drift fails
local checking; inaccessible external copies remain pending in shared mode. Keep the
report with the change review. Reconcile each destination under its selected write
scope, preserving custom content; register/analyze members remain read-only. Then
regenerate/review affected outputs and verify again. Neither report acknowledges a
document review or starts a cross-repository rollout.
