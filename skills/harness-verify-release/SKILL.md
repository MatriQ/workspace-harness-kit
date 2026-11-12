---
name: harness-verify-release
description: Evaluate project-specific readiness before a release, or verify what actually reached an environment after deployment or rollback. Reconcile workflow execution, running artifact identity, technical smoke checks, and business acceptance across selected components.
---

# Verify a release

Produce an evidence-backed verdict for the requested components and environment. Verification starts with inspection. Follow the target project's authorization and environment constraints for probes that write test data. Use the project's existing release procedure for deployments and rollbacks when those operations are explicitly requested.

For a pre-deployment decision, follow [readiness checks](references/readiness.md) and
the project's applicable artifact, rollback, migration, monitoring and review criteria.
Reuse existing authorization. A readiness verdict does not establish deployment execution.

1. Establish the intended target, scope, and release. Use `.harness/workspace.json` to resolve components, capability requirements, typed deployment order, and document pointers; obtain owners from the linked authoritative guides. Resolve the target environment, account or workspace, component identities, expected source revisions, and expected artifacts from authoritative project records. In a multi-component release, establish the expected artifact for each required component and the end-to-end behavior to verify. Freeze this scope before collecting observations; missing observations must not shrink it.
2. Inspect the release run or equivalent publication record. Find the specific deployment operation, target, run attempt, and outcome. Use that operation's state rather than the overall build or workflow conclusion. A skipped deployment is `not run` even when other jobs passed.
3. Read the actual target's version independently from the deployment request or build output. Verify the target identity before making further probes. Compare expected and observed identifiers of the same kind and scope. A healthy old version is a version failure. An ambiguous or unavailable version observation is pending. Use [the evidence reference](references/evidence-and-verdicts.md) for common artifact and rollout cases.
4. Run the authorized project probes and record technical and business results separately. Use the project's health, readiness, error-rate, or backlog criteria as applicable. For business acceptance, execute the required journey with appropriate test data or cite the actual authorized acceptance record. Bind each component business check to its tested `artifact`, and every journey to all participating `artifacts`; missing identities remain pending even if the reported result passed. Include the observation window and data state relevant to each result. For ECS, use the [bounded read-only collector](references/aws-ecs.md) when selected, then collect actual behavior separately.
5. Record and evaluate the outcome using [evidence v1 and the bundled helpers](references/evidence-format.md). Run `scripts/evidence.mjs` against the record; when a workspace capability is declared, add `--workspace` to check its required components. Preserve per-check and attempt results, including recovered failures. Report missing conditions and the next action. If verifying a rollback, record the previous known artifact as the expected result and independently verify the restored running version and affected behavior.

Preserve separate deployment, version, technical smoke, and business acceptance results. Mark the complete release passed only when every required check has positive evidence. Keep credentials, personal data, raw HTTP responses, and full environment or container dumps out of the record.
