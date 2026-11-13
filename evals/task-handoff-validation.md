# Local-context upgrade and author replay validation

Date: 2026-11-13. Candidate source version: 0.3.0. Baseline package:
`bb98b48f6999a28486c5aec7f8c6d78970605440`.

This is an actual compatibility upgrade and author-guided synthetic replay, not a
paired model or independent-reader trial. The [record](task-handoff-validation.json)
contains source hashes and sanitized observations; local paths and raw command
output remain outside the repository.

The exercise materialized five synthetic repositories, generated a Chinese centralized
hub with the old bundled helpers and JSON mapping, added handwritten local/entry-point
notes, then refreshed generated consumers using the candidate before migrating the map. Both old JSON and existing Markdown received recoverable copies before retirement. Existing documents stayed
in their original members. All five member Git worktrees stayed clean. The old map
was copied to ignored recovery storage and retired; the selected Markdown entry kept
its prose and bindings. Shared metadata contained no machine paths. Both entry points,
source checks, lookup from another shell directory and unchanged refresh were checked.
The project used its detached common local-context runtime after generation.

Author replay followed the final entry point, task table and source-backed Chinese
routes for shared writes, refusal, regional asynchronous processing and historical
reference conflicts. The corresponding HTTP/SQLite/worker exercise observed:

| Case | Technical health | Request | Final business state | Business result |
| --- | --- | --- | --- | --- |
| Accepted | passed | 202 | active, zero pending events | passed |
| Claims disabled | passed | 403 | missing | failed |
| Signature contract mismatch | passed | 401 | missing | failed |
| Wrong worker region | passed | 202 | pending, one pending event | failed |

The worker's sequential replay after completion processed zero events. Each owned
loopback server/thread and temporary database was cleaned. This does not establish
cryptographic authentication, concurrent exactly-once delivery, a hosted broker,
provider access, an unexamined downstream or production delivery. No real target's
CI, login or deployment was enabled. Structural checks, author content review and
actual local execution are separate observations; host activation and hosted CI
were not run.

The request/reviewer split is available in [the handoff request](task-handoff-request.md)
and [reviewer notes](task-handoff-review.md). No independent reader or paired-model
trial ran in this exercise; model/token/cost measurements remain unknown. The repository sample is abstracted into roles and boundaries; this exercise does
not require or enroll a real document center. Its concrete fake domain and repository
count are fixture data, not generic initialization requirements.
No causal claim about model-quality or latency improvement is made from this fixture.
