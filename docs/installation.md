# Installation and compatibility

`VERSION` identifies this source package. It does not imply that a matching public
release has been published. Pin the checkout or release artifact your team chooses.

The bundled Node.js installer copies complete selected Skill folders into an
explicit destination. It creates `.workspace-harness-kit-install.json` there with
per-Skill package versions and file hashes. It does not register plugins, edit agent
settings, detect a user's preferred agent, or install global dependencies.

```sh
node scripts/install.mjs plan --destination "$SKILLS_DIR" \
  --skill harness-init --skill harness-verify-release > "$INSTALL_PLAN"
node scripts/install.mjs apply --plan "$INSTALL_PLAN"
node scripts/install.mjs check --destination "$SKILLS_DIR"
```

Plans contain the local destination; keep them outside shared fixtures. Application
rechecks both source and destination. Repeating an unchanged install is a no-op.
An existing unowned folder, changed installed file, missing installed file, or added
custom file is a conflict. The preview reports it and apply refuses to overwrite it.
Preserve and reconcile local customizations before creating a new upgrade plan.
Ordinary copy/write failures restore replaced Skill folders. After a forced process
interruption, inspect the destination and staging directories before removing the
installation lock and making a fresh plan.

Manual installation remains supported: copy a complete Skill folder, or direct an
agent to read its `SKILL.md` in this checkout. The installer does not adopt an
unowned manual installation automatically.

Installing the Kit and generating a project's harness are separate operations.
After installation, invoke `harness-init` in the selected coordinator or repository.
Its `scripts/harness.mjs plan/apply/check` writes the chosen native agent configuration
from a reviewed specification. Generated check and hook runtimes are self-contained;
the project does not need the Kit installed to run them. See
[complete generation](../skills/harness-init/references/generation.md).

## Support boundaries

| Surface | Validation and boundary |
| --- | --- |
| Node helpers | Require Node.js 24+; Git is needed for workspace discovery. Copied Skills need no npm install, TypeScript compiler, or Python |
| Development | `npm ci` installs pinned compiler, bundler, parser dependencies and Node types; tests use `node:test` |
| Synthetic target applications | Python 3.11+ and Git; this runtime is independent of the Node helpers |
| macOS / Linux | CI is configured for both, on Node 24 and 26; configuration alone is not a claim that a hosted CI run passed |
| Windows | Not validated; filesystem permission and locking behavior must be tested before claiming support |
| Direct Skill reading | All five entry points and bundled relative resources can be used directly |
| Agent-managed Skill directory | Folder packaging is tested; choose the directory documented by your installed agent |
| Automatic Skill selection | Agent-specific; not established by helper or fixture tests |
| Native harness generation | Codex and Claude Code files, source-backed documents, optional Skills/commands/agents/rules/settings/hooks and GitHub Actions gate; existing files are merged or reported as conflicts |
| Agent activation | Native formats and direct hook behavior are checked; each installed host must still discover the selected files and establish its project/hook trust |
| Initialization toolchains | Planner and local version probes are bundled; the Skill installs selected missing tools using current provider instructions. Login and target access require the user's actual environment and are separate checks |
| Hosted release integrations | Collectors normalize local job/report exports or an explicit HTTP endpoint; no deployment credentials or live environment are bundled |

## Verify an installation

Run `install.mjs check`, then use the installed release Skill's self-contained sample:

```sh
node "$SKILLS_DIR/harness-verify-release/scripts/evidence.mjs" \
  "$SKILLS_DIR/harness-verify-release/assets/example-release.json" \
  --at 2026-01-01T12:00:00Z
```

Expect exit `0` and `verdict: passed`. This tests packaging and deterministic
evaluation, not the agent's trigger behavior. Use the [behavior exercises](../evals/README.md)
for actual agent trials. From the source checkout, `python3 examples/check.py` tests
installation, complete configuration generation and the five-repository scenario in
a temporary directory. Artifact checks do not imply hosted CI or agent activation.

For local npm packaging, the typed API, and the transition from Python commands,
see [Node runtime and migration](node-runtime.md). An npm registry publication is
not required for copying or installing the bundled Skill folders.
