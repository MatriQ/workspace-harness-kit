# Native agent targets

This reference applies to `layout: "native"`. For `centralized`, generate one
regular `AGENTS.md` and a relative `CLAUDE.md -> AGENTS.md` symlink when Claude is
selected; all supporting content stays in `.harness/`. Verify entry-point loading
and a linked procedure in the actual session. Do not claim native discovery of
Skills, commands or agents from `.harness/` alone.

Check the installed host and its current official contract during initialization.
The maintained adapters below target local Codex and Claude Code. Their directory
names do not make their configuration formats interchangeable.

| Artifact | Codex | Claude Code |
| --- | --- | --- |
| Entry point | `AGENTS.md` | `CLAUDE.md` |
| Skills | `.agents/skills/<name>/SKILL.md` | `.claude/skills/<name>/SKILL.md` |
| Explicit commands | Skill plus `agents/openai.yaml` disabling implicit invocation; invoke with `$name` | `.claude/commands/<name>.md`; invoke with `/name` |
| Custom agents | `.codex/agents/<name>.toml` | `.claude/agents/<name>.md` |
| Standing guidance | `.harness/rules/*.md`, explicitly routed from `AGENTS.md` | `.claude/rules/*.md` |
| Settings and command policy | `.codex/config.toml` and `.codex/rules/harness.rules` | `.claude/settings.json` permissions |
| Pre-tool hooks | `.codex/hooks.json` | `.claude/settings.json` hooks |

## Codex

The adapter uses the current custom-agent fields `name`, `description` and
`developer_instructions`, and inherits the model and permissions. Agent prose does
not create a separate read-only sandbox. See [subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

The selected sandbox and approval settings belong in the parent project config.
Existing permission-profile settings must be reconciled first. Inspect the installed
version and [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).

Command policies render as native prefix rules. They govern the documented command
approval boundary; they are not a universal shell filter. Exercise both matching and
non-matching argv with the installed parser:

```sh
codex execpolicy check --rules .codex/rules/harness.rules git status
```

Use a real selected restricted prefix for the negative case. The check evaluates a
policy; it does not execute that command. See [rules](https://learn.chatgpt.com/docs/agent-configuration/rules).

Project hooks require a trusted project layer and review of the exact hook definition
through `/hooks`. Do not bypass trust or mark activation passed from a direct script
test. See [hooks](https://learn.chatgpt.com/docs/hooks).

In a fresh target session, confirm the entry point, selected Skills, explicit commands
and custom agents are discoverable. Inspect which source wins when old Skill roots
contain the same name. Follow the installed host's discovery behavior; preserve legacy
files until their use has been reconciled. The supported project Skill directory is
also documented in [OpenAI's Skill installation table](https://developers.openai.com/api/reference/cli).

## Claude Code

Use the project's native settings and preserve unrelated values. Inspect effective
permissions with the installed session interface; local or managed settings can alter
the result. See [settings](https://code.claude.com/docs/en/settings).

Skills use standard frontmatter and commands are explicit invocation paths. Check
their discovery and invocation in the target session. See [Skills](https://code.claude.com/docs/en/skills).

Generated subagents inherit host permissions and models. A request to avoid edits in
their body is a behavioral instruction. If a task needs a tool allowlist or another
specific restriction, configure it deliberately under the current
[subagent contract](https://code.claude.com/docs/en/sub-agents); do not infer enforcement
from an agent name such as reader.

The adapter registers a command hook for `PreToolUse` and uses its native deny output.
Inspect it through `/hooks`, run a harmless matching/non-matching probe in the selected
session, and verify that a normal tool call retains the normal permission flow. See
the [hook contract](https://code.claude.com/docs/en/hooks).

## Existing shared layouts and activation record

An in-root `.claude -> .codex` layout is supported: Claude files are written through
their logical `.claude` paths to the existing real directory. Codex still receives
its native TOML, hooks and Skill outputs. Preserve an `AGENTS.md -> CLAUDE.md` alias;
the generator shares one managed entry block when both paths resolve to one file.

Record host version, loaded source paths, discovered capabilities, hook trust and
probe outcomes in ignored local readiness state. Use `passed`, `failed`, `pending`
or `not run`, with the actual evidence and next action. Unavailable hosts, unsupported
versions or missing trust leave activation pending while the artifact report remains
usable. Do not start production operations just to prove the harness is loaded.

The generated hook command resolves its runtime from the Git root. Activate it from
the coordinator's Git checkout or its subdirectories. An ordinary directory needs
an established project root before these repo-local hooks can activate.
