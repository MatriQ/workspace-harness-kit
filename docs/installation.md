# Installation and compatibility

Start with the copyable [quick install](../README.md#quick-install)
([简体中文](../README.zh-CN.md#快捷安装)). It installs all five Skills for a local
Codex or Claude Code user, then shows how to initialize a target repository.
It requires Node.js 24+, Git, curl and Bash on macOS / Linux. No GitHub CLI,
manual clone, npm installation or compilation is needed.

```sh
curl -fsSL https://raw.githubusercontent.com/MatriQ/workspace-harness-kit/main/install.sh | bash -s -- --agent both
```

The bootstrap checks Node, fetches the selected Git revision into a temporary
directory and invokes `scripts/install.mjs setup`. That command creates plans,
rejects conflicts, applies the selection and checks the installed file hashes.
It prints the source commit and installation results, then removes the temporary
checkout on success or failure. It does not install Node, edit agent settings or
initialize a project. Repeating the same command upgrades from the selected ref;
unchanged Skill files are left intact.

All selected destinations are checked for conflicts before the first write. Each
destination has its own lock and recovery transaction. If a later destination
fails during application, an earlier successful installation remains installed;
reconcile the reported problem and rerun the same command.

`VERSION` identifies this source package. It does not imply that a matching public
release has been published. Pin the checkout or release artifact your team chooses.

## Installation options

The bootstrap accepts these options after `bash -s --`:

| Option | Behavior |
| --- | --- |
| `--agent codex` | Install to `~/.agents/skills/`; this is the default |
| `--agent claude` | Install to `~/.claude/skills/` |
| `--agent both` | Install for both hosts |
| `--destination PATH` | Install to an explicit Skill directory instead of selecting an agent |
| `--skill NAME` | Select a Skill; repeat for several; omission selects all five |
| `--dry-run` | Print plans without changing installed Skills; conflicts produce a nonzero exit |
| `--ref BRANCH_OR_TAG_OR_COMMIT` | Fetch that revision instead of `main` |
| `--source DIRECTORY` | Use a local checkout without downloading; cannot be combined with `--ref` |

For example, preview only the initialization Skill for Claude Code:

```sh
curl -fsSL https://raw.githubusercontent.com/MatriQ/workspace-harness-kit/main/install.sh | bash -s -- --agent claude --skill harness-init --dry-run
```

For a pinned installation, set `WHK_REF` to a real full commit ID and use it for
both the bootstrap URL and the downloaded source:

```sh
curl -fsSL "https://raw.githubusercontent.com/MatriQ/workspace-harness-kit/$WHK_REF/install.sh" | bash -s -- --ref "$WHK_REF" --agent both
```

To inspect the source or install offline from an existing checkout:

```sh
git clone https://github.com/MatriQ/workspace-harness-kit.git \
  "$HOME/.local/share/workspace-harness-kit"
cd "$HOME/.local/share/workspace-harness-kit"
bash install.sh --source . --agent both
```

If already cloned, use the existing checkout. To pin a version, check out your
team's chosen commit before generating the installation plan; do not assume a
tag or npm publication exists for the value in `VERSION`. Updating the checkout
alone does not update installed Skills: rerun `bash install.sh --source .` with
the same options, or use the manual plan/apply/check workflow below.

Choose one destination before running the installer from the Kit checkout:

| Agent | User-level destination | Project-local destination |
| --- | --- | --- |
| Codex | `$HOME/.agents/skills` | `/path/to/project/.agents/skills` |
| Claude Code | `$HOME/.claude/skills` | `/path/to/project/.claude/skills` |

These paths follow the [Codex](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)
and [Claude Code](https://code.claude.com/docs/en/skills#choose-where-skills-load)
local discovery contracts. User-level installation keeps the Kit outside project
repositories and makes it available across them. Project-local installation adds
the selected host's Skill directory to that project. Replace `/path/to/project`
with the actual absolute target path. Install separately for each host if using
both; choose the directory supported by your installed host if it differs.

## Preview and apply

For explicit plan review, run the following from a Kit checkout. This remains
available alongside the one-command `setup` operation.

The bundled Node.js installer copies complete selected Skill folders into an
explicit destination. It creates `.workspace-harness-kit-install.json` there with
per-Skill package versions and file hashes. It does not register plugins, edit agent
settings, detect a user's preferred agent, or install global dependencies.

```sh
SKILLS_DIR="$HOME/.agents/skills"
INSTALL_PLAN="$(mktemp)"
node scripts/install.mjs plan --destination "$SKILLS_DIR" \
  --skill harness-init --skill harness-verify-release > "$INSTALL_PLAN"
cat "$INSTALL_PLAN"
```

Review the selected Skills, destination, file changes and conflicts. When the plan has
no conflicts, apply it in the same terminal:

```sh
node scripts/install.mjs apply --plan "$INSTALL_PLAN" &&
  node scripts/install.mjs check --destination "$SKILLS_DIR"
```

Omit all `--skill` options to install all five Skills. A successful check lists
installed versions and an empty `problems` array. The release sample below needs
`harness-verify-release` to be installed.

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
After installation, open a new agent session in the selected coordinator or
repository. Invoke `$harness-init` in Codex, `/harness-init` in Claude Code, or ask
the agent to use `harness-init`. Its `scripts/harness.mjs plan/apply/check` writes
the chosen centralized or native configuration from a reviewed specification.
The default centralized layout keeps supporting files in `.harness/`, with a
regular `AGENTS.md` and `CLAUDE.md -> AGENTS.md` when Claude Code is selected.
Generated check and hook runtimes are self-contained;
the project does not need the Kit installed to run them. See
[complete generation](../skills/harness-init/references/generation.md).

## Troubleshooting

| Symptom | Next step |
| --- | --- |
| Download or Git fetch fails | Check network access to `raw.githubusercontent.com` and `github.com`, and verify that the selected ref exists. A fetched checkout is removed after failure; installed Skills are not changed before setup |
| `node` is missing or older than 24 | Install Node.js 24+ and verify `node --version` in the terminal used by the agent |
| You already have a checkout | Run `bash install.sh --source .` from its root with the same agent or destination options |
| The plan reports conflicts | Preserve and reconcile the listed unowned or changed files, then make a fresh plan. The installer does not provide a force-overwrite shortcut |
| Installation checks pass but the Skill is unavailable | Confirm the installed host's discovery directory, start a new session, and look for `harness-init` in its Skill picker. Check for disabled or duplicate installations. Packaging checks do not establish host loading |
| You want to use a Skill without installing it | Ask the agent to read the absolute path to `skills/harness-init/SKILL.md` in this checkout and follow it in the target repository; keep the complete checkout available for its relative resources |

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
| Bootstrap | Bash 3.2+ on macOS / Linux; checks Node.js 24+, uses Git for a temporary fetch, then runs the bundled installer. Downloading the bootstrap command uses curl |
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
