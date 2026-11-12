# Azure initialization

Establish the cloud, tenant, subscription, regions, resource groups, services and
environments. Reuse existing project access and distinguish sovereign clouds from
the public cloud.

For CLI access, inspect `az version`. Install a missing CLI using the
[official OS-specific instructions](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
and verify it before configuring access. Follow the organization's
[authentication method](https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli).
Prefer an existing scoped configuration; changing the active cloud or subscription
affects other commands and must be part of the selected setup, not a hidden side effect.

After login, inspect the intended subscription explicitly:

```sh
az account show --subscription "$SUBSCRIPTION" \
  --query '{subscription:id,tenant:tenantId,cloud:environmentName}' --output json
```

Check this against the expected identity, then perform one authorized resource read.
[Account inspection](https://learn.microsoft.com/en-us/cli/azure/account) does not
prove service-specific or deployment permissions. Do not emit access tokens as
readiness evidence.

Write service-specific release and operations procedures from actual sources.
AKS can require kubectl; App Service does not. For Azure Pipelines, determine whether
an existing connector or the Azure DevOps extension is needed, and verify that
extension separately. Record local login/context readiness separately from shared
resource and workflow documentation.
