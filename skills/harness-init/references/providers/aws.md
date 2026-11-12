# AWS initialization

Establish the partition, account, regions, services and environments from project
sources or user context. Keep separate profiles/targets for distinct partitions or
accounts. Confirm whether access already comes through SSO, a role, workload identity
or an available connector.

For CLI access, inspect `aws --version`. If missing, follow the current
[AWS CLI v2 installation instructions](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
for the host OS/architecture and verify the installed executable. An existing CLI
v1 needs a deliberate compatibility decision because both versions use `aws`.

For IAM Identity Center, use the organization's existing configuration or the
[documented SSO setup/login flow](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html),
including `aws sso login --profile "$PROFILE"` when applicable. Do not invent an
SSO start URL or request access keys in chat.

Use an explicit profile and region for
[caller identity](https://docs.aws.amazon.com/cli/latest/reference/sts/get-caller-identity.html):

```sh
aws sts get-caller-identity --profile "$PROFILE" --region "$REGION" --no-cli-pager
```

Compare the returned identity locally with the intended account, then verify one
service-specific authorized read. Document actual release workflows, resource
identifiers, log/metric entry points, bounded investigation commands and rollback
sources for selected services. ECS does not imply Kubernetes tooling; add kubectl
only for a selected Kubernetes workflow. Keep credentials and machine profile names
out of shared documents.
