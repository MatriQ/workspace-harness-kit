# Prepare the selected toolchain

Use this procedure after the initialization interview identifies relevant work and
platforms. Installation is an execution step, not merely a list of recommendations.
When the user requests setup with missing-tool installation, carry it out within
that scope and verify it. Inspect-only and documentation-only choices retain their
meaning throughout the run.

1. Inspect the OS, architecture, current package manager, existing connectors, and
   repository runtime/tool pins. Run the bundled `onboarding.mjs tools` for selected
   maintained CLI probes. Inspect project-specific tools separately. Keep the
   harness's Node runtime distinct from a member application's runtime.
2. For each missing required tool, use the current vendor installation instructions
   for this OS/architecture, or the team's documented package source. Choose a
   version compatible with the project. Show the executable/package, source,
   installation location, system-wide effects and validation command before running
   the installation. Proceed under existing authorization; ask only if scope or a
   necessary privilege is missing. A platform selection alone is not an instruction
   to install every associated product.
3. Install the missing tools with the chosen native installer/package manager.
   Reuse compatible installations. If an existing version is incompatible, resolve
   the project's constraint before upgrading or replacing it. Do not silently add
   a new package manager, overwrite a default cloud profile, or change shell startup
   files. A permission/network failure leaves that tool pending; continue independent
   documentation work and retain an exact next action rather than retrying indefinitely.
4. Re-run version probes. For SDK/CLI extensions or plugins, verify the required
   extension separately; a base CLI's presence does not prove it is installed.
   `kubectl` checks use `--client`; Docker's version check does not prove a daemon
   or application is running.
   With inspect-only setup, inspect existing readiness and document missing steps;
   leave installation and new login/configuration unexecuted unless separately requested.
5. Reuse a selected existing login/profile/connector and validate its intended
   scope. For new authentication, follow the organization's established SSO,
   device/browser login or workload identity method. Let the user complete any
   interactive login; never request secret values in chat. Keep local credentials
   with the provider's credential store and local profile/context names in ignored
   status, not the shared onboarding profile.
6. Compare the observed target identity with the intended account/subscription/project
   and region before a service-specific read. Verify one representative authorized
   read for the requested service, such as service state or a bounded log query.
   Identity lookup alone does not prove permission to read logs or deploy. Stop target
   probes on an identity mismatch and resolve it; do not select another account by guess.
7. Write installation, login renewal, context selection, validation and troubleshooting
   procedures into the selected toolchain/environment guides. Record installation,
   login and target access as separate results. Setup does not itself deploy a
   workload, create cloud resources, restart a service or modify production data.

Read only the references for selected providers:

- [AWS](providers/aws.md): CLI v2, partition/profile, identity and service access.
- [Azure](providers/azure.md): CLI, cloud/tenant/subscription, extensions and resources.
- [Google Cloud](providers/gcp.md): CLI configuration, project and service access.
- [Other platforms and self-hosting](providers/other.md): use the actual vendor or existing project interface.

Optional tools are justified by an observed workflow or an explicit choice:

| Tool | When needed | Installation source |
| --- | --- | --- |
| GitHub CLI | Selected GitHub Actions release inspection without another working interface | [GitHub CLI installation](https://github.com/cli/cli#installation) |
| kubectl | Kubernetes workloads requiring cluster inspection | [Kubernetes client tools](https://kubernetes.io/docs/tasks/tools/) |
| Helm | The project manages the selected release through Helm | [Helm installation](https://helm.sh/docs/intro/install/) |
| Terraform | The requested task uses the project's Terraform configuration | [Terraform installation](https://developer.hashicorp.com/terraform/install) |
| Docker | Local container execution or the selected build workflow needs it | [Docker installation](https://docs.docker.com/get-started/get-docker/) |

An Azure Pipelines workflow may require the Azure DevOps CLI extension. GitLab CI
or another platform may use a connector or its vendor CLI. Read their actual
workflow requirements before adding tools; unsupported names remain manual checks
in the helper rather than executable commands supplied through JSON.
