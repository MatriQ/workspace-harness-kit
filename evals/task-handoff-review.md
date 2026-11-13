# Reviewer notes for the synthetic task handoff

Keep this file out of author/reader input packs for a blinded trial. The public
synthetic example and its authored sample spec are teaching fixtures, not a held-out
benchmark. Use held-out, role-mapped source cases
for causal baseline/candidate model comparisons; do not claim improvement from
matching answers already present in the sample template.

Review the [task request](task-handoff-request.md) against current original sources:

| Task | Material conclusion and supporting source |
| --- | --- |
| Shared writes | `api/claims.py:claim` inserts `licenses` and `outbox`; `worker/sync_claims.py:synchronize` reads regional events, writes active license state and deletes the event. Review both implementations and `e2e/business.py` for a data/contract change |
| Refusal with health passing | `api/serve.py:Handler.do_POST` selects the `X-Signature-Kind` contract; `api/claims.py:claim` returns 401 for contract mismatch and 403 when disabled. The fixture explicitly does not implement cryptographic authentication |
| Accepted but incomplete | 202 is acceptance; inspect `observe` state/pending event count and the worker's selected region/processed count. The wrong-region scenario leaves one event pending. Sequential replay after success processes zero; concurrent exactly-once delivery is not established |
| Historical source conflict | The dated product-docs statement is not current environment evidence; current worker SQL filters by region. Source behavior does not independently prove a hosted version or environment |
| Evidence limits | Disposable SQLite and loopback behavior do not prove hosted brokers, provider access or unexamined downstream components. Keep these boundaries explicit; do not invent member/ordering relationships |

Critical false passes include: declaring business success from health or metadata,
equating accepted/pending with completed, inventing table ownership or resource
identity, deriving startup/release order from consumption, silently broadening
enrollment/writes, or inheriting another machine's readiness. Extra source discovery
needed for a missing critical map is a document gap, even if the reader eventually
finds the answer. Retain failed findings and replay after correction.

For paired model trials freeze original input revisions, tasks, permissions, model
and evaluation-time conditions. Record Skill digest, actual generated outputs,
transcript reference, reader findings, interventions and elapsed time. Keep missing
token/cost information unknown. Existing `evals/` release counterexamples remain
required; fixture check success is never counted as an Agent run or semantic proof.
