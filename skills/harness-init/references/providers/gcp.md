# Google Cloud initialization

Establish the project, regions/zones, services, environments and existing identity
method. Distinguish a developer's named CLI configuration from a service's runtime
identity and application-default credentials.

For CLI access, inspect `gcloud version --format=json`. Install missing tools through
the [official Google Cloud CLI instructions](https://docs.cloud.google.com/sdk/docs/install-sdk),
respecting host OS/architecture and project constraints. Follow the organization's
[authentication procedure](https://docs.cloud.google.com/sdk/docs/authenticate);
`gcloud auth login` is appropriate for an interactive user login when requested.

Reuse the intended named configuration. Inspect its selected account/project using
the [configuration commands](https://docs.cloud.google.com/sdk/docs/configurations),
then check a project or service resource with explicit configuration and project
flags. A configured account name is not evidence of a valid session; a successful
authorized read establishes the tested access. Avoid changing the global active
project merely to run a probe.

Write the actual release route, service identities, log/metric sources and escalation
paths. Add kubectl for an applicable GKE workflow, not for every Google Cloud service.
Keep local authentication details out of shared guides and never generate service
account keys merely to complete initialization.
