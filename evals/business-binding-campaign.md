# Component business artifact binding: independent forward test

Six actual independent agent runs on 2026-11-11 exercised three identical synthetic
inputs against a frozen pre-change Skill and a candidate Skill. Each run started in
a fresh directory and agent context, read only its request, Skill and raw evidence,
and wrote an answer without seeing the assessor or intended outcome. All used the
same inherited session model and tool permissions; no model override was selected.
The exact runtime model ID was not exposed. No human correction was supplied.

The [sanitized measurements](business-binding-campaign.json) retain fixture and full
Skill digests. Raw artifacts, timing records and session transcripts remain local.
The candidate's release evaluator, Skill entry point and evidence contract match the
final source tree. Unrelated readiness/ECS helper changes after the frozen snapshot
are covered by deterministic tests, not these agent trials.

| Metric | Baseline (3 runs) | Candidate (3 runs) |
| --- | --- | --- |
| Complete machine-readable result matches | 0 | 3 |
| Exact verdict matches | 1 | 3 |
| Correct accept/block decisions | 2 | 3 |
| Final agent false passes | 0 | 0 |
| Human interventions | 0 | 0 |
| Measured total task time | 243.12 s | 168.19 s |
| Application smoke runs | 0 | 0 |
| Tokens and cost | Unavailable | Unavailable |

The missing-artifact input exposed a passing **baseline evaluator** result. Its agent
noticed the unsupported business claim and manually changed the final verdict to
pending; this was not a final agent false pass. The resulting hand-authored check
detail did not exactly match the independent result. The candidate returned the
complete pending result directly.

For a wrong tested artifact, the baseline evaluator rejected the business `artifact`
field and returned invalid. The baseline agent's explanation still identified the
mismatch and blocked acceptance. The candidate produced the expected failed check
with its observed and expected identities intact. For the correctly bound positive
control, the baseline also rejected the field, while the candidate passed it.

The difference demonstrates a schema/evaluator regression correction and more complete
machine-readable evidence. It does not establish that baseline agents blindly accepted
bad evidence. Three cases per variant are too few for a reliable speed or quality
benchmark. Elapsed time includes tool work and varies with scheduling; unavailable
token/cost measurements remain null. These offline evidence tasks did not exercise
native host hook loading, cloud access or application smoke. The separate five-repo
integration example exercises a real loopback application smoke through doctor.
