# Release evidence and verdicts

Read this reference when comparing artifact identities, recording a rollout or rollback, or reporting partial verification.

## Match the artifact and the target

| Evidence | What to record |
| --- | --- |
| Expected source | Repository and full commit SHA, linked to the release run or build record |
| Expected artifact | Artifact kind and immutable identifier from the build or publication record |
| Target identity | Environment and exact account, service, cluster, workspace, or publish channel needed to distinguish targets |
| Deploy or publish execution | Specific operation, run and attempt or event ID, time, target, and result |
| Observed artifact | Identifier read from the actual target, platform and active replicas when relevant, observation time, and evidence location |
| Technical and business probes | Scenario, authorized test data or data state, expected result, observed result, and evidence location |

Compare a registry digest to the corresponding registry digest, a runtime revision to the expected revision, or an exact resolved package version to the intended package version. A Docker image ID, an OCI manifest digest, and a multi-platform index digest identify different objects. Where the runtime exposes a different identity kind, use trusted metadata that connects the two and preserve the relationship as evidence. A source SHA reported by an endpoint can verify the declared source revision. Exact artifact verification additionally needs a trustworthy mapping to the deployed artifact. Mutable tags identify a selector and need an immutable resolution before they can prove version identity.

During rolling or canary releases, use the declared exposure target. Record the observed old and new revisions and the applicable traffic or replica split. An expected canary mix can pass its canary check. A remaining old revision after a completed full rollout fails the version check when the policy requires all active replicas to match.

## Record independent results

Use one row per component and check. A single business journey can have its own row and link to the participating component versions.

| Component | Check | Expected | Observed | Status | Evidence and time |
| --- | --- | --- | --- | --- | --- |
| Member ID | Deployment execution, running version, technical smoke, or business acceptance | Target-specific criterion | Sanitized observation | Status below | Source link or record ID and timestamp |

- `passed` means the available evidence meets the stated criterion.
- `failed` means an observed result violates the criterion. A verified wrong target or version is a failure.
- `not run` means the operation or probe was explicitly skipped or has not been executed.
- `pending` means a required observation, credential, permission, environment, or acceptance record is unavailable or inconclusive. State what would resolve it.
- `not applicable` means the project or requested scope does not require the check. Record the reason.

A passing workflow with a skipped deployment keeps the deployment result `not run`. A passing health check with a mismatched version can support a technical probe result while the version check remains `failed`. A passing version check with a failing customer journey leaves business acceptance `failed`. After rollback, run the same independent version and behavior checks against the explicitly identified prior artifact.

For executable records, use [evidence v1](evidence-format.md). A probe's raw health
result may pass on an old version, but the evaluator's technical check also verifies
that the probe exercised the required artifact. Retain the raw observation summary
when that stricter technical criterion fails.
