# Local harness documentation validation

On 2026-11-11, three isolated synthetic workspaces were initialized and handed to
three fresh readers. The readers implemented or exercised the documented workflow,
recorded missing instructions, and preserved their results. After corrections, all
three final workspaces passed artifact checks and strict local workspace checks.
The resulting 16 guides cover all 15 required activity topics across the cases.

This is a focused handoff exercise with six actual agent runs: one author and one
consumer per case. Consumers received a separate local copy and its guides, without
authoring evidence, the Kit implementation, sibling cases or an assessor answer.
Root verification subsequently used the corrected guides and current helpers.
It is not a comparative model benchmark. Raw command records, plans, source hashes
and complete generated workspaces are retained locally; this report and its
[structured summary](harness-docs-validation.json) omit machine paths and raw output.

## Cases and observed results

| Case | Selected scope and documents | Actual exercise | Final result |
| --- | --- | --- | --- |
| Empty repository | Development/testing; four guides and Codex entry point; no application created during authoring | Fresh reader implemented the complete dependency-free CLI and behavior test from the guides. Final replay created the missing root ignore file, generated the lockfile offline, ran locked install, direct/shebang/npm startup, the test, separated evidence capture and scoped cleanup. | Exact `Hello, Casey!` plus newline, empty direct stderr and exit 0; test also checks Morgan. Passed on Node 24.12.0. |
| Existing Node service | Development/testing; four guides and both host entry points; handwritten instructions retained | Locked install, required test and smoke, actual server startup with explicit environment loading, four HTTP requests, shutdown and cleanup. | Health/version observations, quantity 2 producing USD 24, and quantity 0 producing HTTP 400 all matched the guides. Passed on Node 24.12.0; original files unchanged by execution. |
| Multi-repository coordinator | All four activities for local processes; eight guides including architecture; both hosts; five external members in analyze mode | API/client/worker journey, four release scenarios, stale API investigation and recovery, version comparison, acceptance inspection and cleanup. | Scenario exits were 0, 1, 2, 1 as documented. Manual recovery restored the selected API revision and accepted greeting. Five member repositories stayed clean, source hashes matched, and both coordinator symlinks survived. |

The single-service README deliberately contradicted current sources: it named Node
20, port 3000 and a nonexistent `npm run verify`. The author identified those as
historical statements and derived the guides from the runtime pin, manifest,
workflow, contribution guide and implementation: Node 24, port 4317 and the actual
test/smoke scripts. Both the independent reader and final replay used the corrected
instructions without editing the application.

The multi-repository scenarios distinguish successful execution, a healthy but stale
API revision, absent deployment execution, and a rejected business journey despite
passing technical checks. The consumer inspected target, component versions,
artifact-bound acceptance and freshness before accepting the local rehearsal. The
manual recovery stopped only its owned API process, relaunched with the selected
revision, reran the client/worker flow and verified that owned listeners stopped.
This verifies a configuration recovery; it does not establish code rollback.

The independent consumers used Node 26.5.1, which satisfies `>=24` but does not prove
the requested major-24 baseline. The final empty and single-service runs therefore
used the existing Node 24.12.0 executable and its PATH explicitly. Python fixture
execution used 3.14.5 and Git used 2.53.0. No runtime installation was needed for
the application exercises.

## Findings and corrections

| Observed gap | Correction | Verification |
| --- | --- | --- |
| A one-page harness passed artifact checks despite selecting development/testing documents. | Derive required topics from explicit profile choices. Validate nonempty content or explicit mappings to existing source sections. | Missing topics fail; excluded activities are not required. Combined handbooks pass with valid mappings; empty, absent, ambiguous and undeclared sections fail. |
| Empty-project recipes failed command checks because future application files did not exist. | Add `phase: "planned"` with a required reason; retain pending status. Default/current command checks remain strict. | Empty authoring harness passes with future commands pending. After implementation, five literal application command occurrences pass declaration checks as current. |
| A missing heading fragment and unresolved named reference were accepted. | Check local Markdown heading anchors and named references, excluding examples and code. | Broken navigation fails. Repeated/Unicode headings and valid references pass; fenced examples do not create false missing-link findings. |
| Empty-project guide assumed a root `.gitignore` already existed. | Explicitly allow creating it and preserve `.harness/.gitignore`. | Final replay started without a root ignore file and completed the recipe. |
| Test evidence example merged streams despite asking to retain them separately. | Use separate stdout, stderr and status files. | Final replay executed the corrected shell block and checked both stored exits and exact smoke output. |
| The empty-project handoff did not specify how to refresh after implementation. | Document source registration, command promotion, generator preview/apply and final document review. | Actual installed bundled helpers completed that sequence; eight source/review warnings became zero after reviewed refresh. |
| Readers needed to discover the ignored member-path registry. | Name `.harness/workspace.local.json` and its checkout keys in the guidance. | Final copies resolved every execution root through the registry. |
| Consumer preparation changed checkout paths but retained old Git-directory bindings. | Correct the fixture preparation and document planner-based relocation, retaining member modes. This was a preparation error, not a demonstrated planner defect. | Final copies were rebound through the planner; both path and Git-directory identities matched and strict checks passed. |
| Multi-repository guides referenced prior evidence files not shipped to a copied consumer workspace. | Make evidence availability explicit and provide the fresh-run path with distinct output filenames. | Fresh final scenarios produced retained command/evidence records without relying on unavailable historical files. |

These changes are in the [document blueprint](../skills/harness-init/references/documents.md),
[generation contract](../skills/harness-init/references/generation.md),
[verification guidance](../skills/harness-init/references/verification.md), and
[workspace relocation procedure](../skills/harness-init/references/workspace.md#relocate-local-checkouts).
The complete synthetic generation spec now supplies all seven activity topics.

## Checks completed

- `npm test`: 128 passed, including five new documentation regressions.
- `npm run check:types` and `npm run check:bundles`: passed.
- `npm run check:evals`: all twelve fixture expectations matched; this command itself
  performs zero agent runs.
- `npm run check:examples`: five repositories, five installed Skills, 31 generated
  files, four hook cases, a real doctor application smoke and four release outcomes
  matched. Overall doctor status correctly remains pending for native activation.
- `npm run check:package`: packed CLI, public types, offline consumer install,
  detached Skills and generated standalone runtime passed.
- Skill creator `quick_validate.py`: all five Skills passed.
- Final generated workspaces: required topic coverage 4/4, 4/4 and 7/7; artifact
  checks passed and strict local checks reported zero errors and warnings.
- Local repository Markdown links and fragments were checked after documentation
  updates; no broken local route was found.

The empty final fixture also exercises the post-delivery lifecycle: implementation
adds genuine sources, the registry reports drift, the reviewed spec snapshots five
application inputs, implemented commands become current, the generator updates
owned files, and explicit final prose reviews restore freshness. The original
documentation-only fixture remains separate and still creates no application files.

## Limits of the result

Topic coverage establishes presence, not factual truth. The source audit and actual
reader/application exercises support the correctness of these specific guides.
The bounded Markdown inspector is not a complete Markdown renderer. Static command
notices remain visible for quoted scripts, redirects, variable-based helper paths
and version probes: 11, 3 and 8 in the final cases respectively. Actual execution
records are separate; a successful artifact exit does not clear those notices.

Automatic native host discovery/trust, native hook activation, hosted CI, real cloud
deployment/access, production availability and code rollback were not exercised.
The local release rehearsal must not be reused as evidence for those targets.
