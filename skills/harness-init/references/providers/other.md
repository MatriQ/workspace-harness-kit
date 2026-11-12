# Other platforms and self-hosting

Record the actual platform name, hosting model, services, environments and existing
deployment/operations interface. This includes another cloud provider, on-premises
Kubernetes, SSH-managed hosts, a PaaS or a vendor dashboard. Do not translate an
unknown platform into AWS or install a familiar CLI by assumption.

Read project-owned scripts and vendor installation/authentication documentation.
Choose an existing connector, a documented CLI, or documentation-only access. For
each necessary tool, establish its official source, compatible version, supported
host installation method and local version check. Custom tool names in the profile
are descriptive: the bundled helper deliberately leaves their probes manual.

Install missing tools only in the requested setup scope, then validate the real
interface. Separate local installation from authentication and target access. Use
explicit host, cluster/context or project selection. For Kubernetes, inspect the
client first, then a narrowly scoped authorized cluster read; do not fetch or merge
an unknown kubeconfig into the default configuration.

Generate guides around verified commands and real evidence sources: release entry
point, artifact/version observation, logs and metrics, recurring investigations,
rollback, and escalation. When no usable interface or credentials are available,
retain the missing step visibly and complete the source-backed documentation.
