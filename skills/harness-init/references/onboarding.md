# Progressive initialization

Use a short conversation to establish the work this harness should support, then
act on that scope. This is not a fixed questionnaire: supplied background and
confirmed repository evidence can answer entire stages. Do not ask the user to
repeat facts or approve an action already included in their request.

## Ask in dependency order

| Stage | Establish | Follow-up only when needed |
| --- | --- | --- |
| Language | Language of generated guides and Agent instructions | Present English (`en`) and Simplified Chinese (`zh-CN`); ask when unanswered, otherwise state the confirmed choice and reuse it |
| Background | What the system does, its users, recurring tasks and the intended harness audience | A short free-text description if absent; inspect README and existing instructions in parallel |
| Activities | Development, testing, deployment, operations, or a combination | “Should this harness also help with releases or operational investigation?” A declined activity remains out of scope |
| Platforms | Hosts for the selected release/operations work | “AWS, Azure, Google Cloud, self-hosted, another platform, or several?” Do not ask this for a development-only workspace |
| Services and environments | Actual service types, target environments, account/subscription/project boundaries, regions and existing source documents | For AWS distinguish ECS/EKS/Lambda/VMs; for Azure distinguish AKS/App Service/Functions/VMs. Kubernetes is a workload choice on a provider, not a reason to assume another cloud |
| Delivery and investigation | Existing release trigger and pipeline when deployment is selected; logs, metrics, queues, alerts and escalation when operations is selected | Read workflows and infrastructure first. Ask for unavailable business or environment context; do not invent resource names |
| Tool setup | Reuse connector/project tools, use provider CLI, or write guidance only; install missing tools or inspect only | Check the host OS/architecture, package manager and installed tools. Reuse current authorization and preferences; a saved profile alone does not authorize a different user's installation |
| Placement | Central coordinator or member-local guides; existing entry point and documentation root | Infer from the user's requested destination and existing conventions. Ask only when the location is ambiguous |
| Existing documents | Documents outside the chosen harness root, their purpose and affected callers | Show the inventory and proposed destinations; ask which to migrate or keep. Do not move files merely because initialization was requested |
| Agent configuration | Target local agent(s) and useful harness artifacts | Reuse the current host and existing files where clear; select guides, Skills, commands, agents, rules, settings, hooks and CI through the [generation workflow](generation.md) |

Ask one or two questions at a time. Present platform choices only after the relevant
activity is selected. Unknown facts can stay unanswered while source inspection,
local analysis and document drafting continue. Never infer “not needed” from silence.
Show the resolved scope before changing tools or files; proceed with actions already
authorized by the request instead of adding a separate approval loop.

## Record answers and inspect the plan

For repository Agent initialization, follow the [bootstrap workflow](repository-bootstrap.md)
and include `harness` in the profile. Start it as `{}` when host or artifact choices
are unresolved. The planner retains legacy documentation behavior when this field
is absent; that compatibility path is not the default deliverable of a new complete
repository initialization.

Maintain a local working JSON profile with only sanitized background and choices.
Start with `{"schema_version":1}` and fill known fields. Missing fields are unanswered;
`false` means the user excluded an activity. The complete
[synthetic AWS profile](../assets/onboarding-aws.json) illustrates the contract.

```sh
node "$SKILL/scripts/onboarding.mjs" plan "$PROFILE"
node "$SKILL/scripts/onboarding.mjs" tools "$PROFILE"
```

`plan` returns remaining questions, provider references, required tools and document
topics. Present a useful summary, not its raw JSON. It exits `0` for valid partial
profiles as well as complete ones; `status: needs-input` preserves unanswered items.
`planned` means choices are complete, not that setup ran. `tools` executes only the
maintained local version probes and exits `2` if a probe or required answer remains
pending. Custom tool names are listed for manual inspection and are never executed
from profile content. Neither command installs software or logs into a provider;
the agent performs those steps using [toolchain preparation](toolchains.md).

| Field | Meaning |
| --- | --- |
| `language` | Explicit `en` or `zh-CN` choice for generated prose; missing remains a question, not an English default |
| `background` | Short system purpose and user goals; no machine paths, credentials or raw diagnostics |
| `activities` | Boolean choices for `development`, `testing`, `deployment`, `operations` |
| `platforms` | Entries with stable `id`, `provider` (`aws`, `azure`, `gcp`, `other`), service and environment names; `other` also needs `name` |
| Platform `access` | `cli`, `existing-tools`, or `documentation-only` |
| Platform `delivery` | `github-actions`, `azure-pipelines`, `gitlab-ci`, `manual`, or `other`; needed only for deployment |
| Platform `tools` | Explicitly needed extras such as `kubectl`, `helm`, `terraform`, `docker`, or a custom vendor tool; do not select these speculatively |
| `tool_policy` | `install-missing` or `inspect-only`; a saved preference, not a permission grant |
| `documentation` | `placement` (`coordinator` or `members`), relative `root`, optional relative `entrypoint`; defaults are `.harness/docs/` for centralized layout and `docs/harness/` for legacy native layout |
| `documentation.existing_documents` | Optional explicit choices `{member, path, action: "keep"}` or `{member, path, action: "move", destination}`; paths and destinations are member-relative, destinations are inside `documentation.root`. These record intent and never execute a migration |
| `harness` | Optional `targets` (`codex`, `claude-code`) and boolean `artifacts` choices for complete generation; start with `{}` to retain its unanswered questions |
| `harness.layout` | `centralized` for one `.harness/` directory and linked root entry points, or `native` for host-specific discovery and integrations; save the choice explicitly on new initialization |

The planner asks for a tool policy when local development/testing or CLI access is
selected. Documentation-only and existing-tool access do not require an installation
choice. Runtime/package-manager requirements for development and testing come from
member source analysis; the fixed probe catalog covers selected platform tools.

Persist a snapshot through the workspace's existing reviewed plan/apply flow:

```sh
node "$SKILL/scripts/workspace.mjs" plan --workspace "$WORKSPACE" \
  --profile "$PROFILE" --member api analyze "$API_REPO" > "$PLAN"
node "$SKILL/scripts/workspace.mjs" apply --plan "$PLAN"
```

The shared registry stores this as `onboarding`. Omission of `--profile` preserves
it; supplying a profile replaces that object, so start a refresh from existing
choices. The plan embeds the reviewed profile; later edits to the working profile
file require a new plan. Do not store local login/profile names or tokens here.

The profile's language sets the workspace language when `--language` is omitted.
An explicit supported `--language` also records the answer in onboarding; a supplied
profile with a conflicting language is rejected. Member overrides still apply.
Use the effective language in the generation spec. Show the saved choice on refresh
without restarting the interview. Legacy profiles lacking it remain readable but
the onboarding planner reports the unanswered language question.

The workspace plan separately reports `document_consolidation` for selected
analyze/init members. Ask its pending document question using the actual inventory;
do not ask whether documents exist when they can be inspected. Save the user's
per-document decisions and follow the [migration workflow](documents.md#existing-documents-and-future-placement).

For central documentation, analyze external service members. If the coordinator is
a Git repository, also select it as an analyzed member to record reviews of its
guides. Resolve `AGENTS.md -> CLAUDE.md` to `CLAUDE.md`, preserve the symlink, and
register the real relative document path. Existing `.codex/docs/` or another established
layout takes precedence over the suggested paths. Generated `index.md` is a plan
topic: reuse a suitable existing index instead of creating a duplicate.
Member-local guide generation applies to members selected in `init` mode; a placement
preference does not expand the write scope of `register` or `analyze` selections.

## Completion and resume

Write guides from the [activity blueprint](documents.md#activity-driven-guides).
The toolchain and environment guides explain how to repeat setup; machine readiness
belongs in an established ignored local status file. When using the workspace's
ignored `workspace.local.json`, an `onboarding_status` object can hold sanitized
results; preserve `schema_version`, `checkouts` and unrelated fields. Verify ignore
rules before adding local status. Do not mark a status passed from a user's intended
configuration or a version probe alone.

Record each relevant layer with a timestamp, `passed`/`failed`/`pending`/`not run`,
a short evidence reference, and the next action:

- Tool installation: the selected executable/version and any project version constraint.
- Authentication: successful provider login or connector authentication; user interaction may be pending.
- Target identity and access: expected versus observed account/subscription/project, region and the specific authorized resource read.
- Documentation: actual written/reused paths, sources, unresolved facts and document review results.
- Harness activation: generated artifact checks, host version and loaded sources, Skills/commands/agents discovery, effective settings and hook trust/probes; hosted CI results remain a separate observation.
- Execution: startup, tests or release verification only when requested and actually run.

For documentation-only access, mark unused access checks `not run` with that reason.
For inspect-only setup, report missing tools and their supported install method;
continue writing useful guides. On resume, reuse the profile, preserve existing
config, recheck time-sensitive authentication and resource access, and perform only
remaining work. No repetitive interview or blanket reinstall is needed.

Document reviews bind to the current onboarding profile as well as source files.
Changing the selected activities, platforms or placement makes earlier reviews
pending until the relevant guides have been reviewed again.
