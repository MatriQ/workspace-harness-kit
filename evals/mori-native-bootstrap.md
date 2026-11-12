# Mori 原目录 Agent 工作环境初始化

2026-11-12，按用户确认的开发、测试和本地启动范围，在实际 Mori 仓库中执行了 workspace-harness-kit 初始化。目标为 Codex 与 Claude Code，新增说明使用简体中文。参考已有 harness 的能力组织，具体命令、模块边界与规则均来自 Mori 自身。

## 实际写入

生成并应用了 33 个受管文件，另建立工作区登记、生成记录和被 Git 忽略的本机绑定。已有 `AGENTS.md` 手写规则逐字保留，新增受管入口；新建 `CLAUDE.md`。

| 能力 | 名称 | 原生位置 |
| --- | --- | --- |
| 4 个 Skills | `mori-guide`、`mori-change`、`mori-test`、`mori-local-setup` | Codex：`.agents/skills/`；Claude Code：`.claude/skills/` |
| 3 个显式命令 | `mori-verify`、`mori-resume`、`mori-local-smoke` | Codex：带显式调用策略的 Skills；Claude Code：`.claude/commands/` |
| 2 个子代理 | `mori-code-reader`、`mori-test-planner` | Codex：`.codex/agents/*.toml`；Claude Code：`.claude/agents/*.md` |
| 2 组规则 | `mori-engineering-boundaries`、`mori-validation-evidence` | Codex：由入口引用 `.harness/rules/`；Claude Code：`.claude/rules/` |
| 3 份中文指南 | 工程索引、本地启动演练、Agent 工作流 | `docs/engineering/` |

Codex 的 Skill 与子代理采用对应的原生目录和格式，没有把参考仓中的目录名当作跨宿主兼容保证。[Skill 目录说明](https://learn.chatgpt.com/docs/build-skills)、[子代理格式说明](https://learn.chatgpt.com/docs/agent-configuration/subagents)。Claude Code 使用其原生 `CLAUDE.md` 入口。[入口说明](https://code.claude.com/docs/en/memory)。

现有 `skills/mori-engineering/SKILL.md` 继续作为工程流程真源，新增发现适配引用它；现有验证、架构、任务和客户端指南保持原文。配置明确排除本次未选择的发布与运维。没有为了凑齐目录而生成空设置，也没有改变模型、权限策略、hook 或 CI。

## 验证结果

| 检查 | 结果与边界 |
| --- | --- |
| 严格工作区检查 | 通过，32 份文档或配置的审阅有效，无错误或警告。 |
| 生成文件、链接、来源与原生格式 | 通过，配置清单标识为 `repository-harness` 并列出各类实际文件。 |
| 脱离 Kit 的独立检查器 | 通过，从证据目录直接运行生成的检查器。 |
| 再次生成 | 使用已保存配置，从另一工作目录预览，33 个文件均无变化。 |
| Codex 实际 Skill 发现 | `codex-cli 0.167.0` 的 app-server `skills/list` 发现并启用全部 7 个项目入口；无目标解析错误。 |
| Mori 基础检查 | 在实际仓库执行 `npm run verify`，退出码为 0。 |
| Mori Web 验证 | `npm run verify:web` 通过：8 项测试及 39 个 JavaScript、10 个 Python 文件语法检查通过。 |
| Kit 回归检查 | 130 项测试通过，bundles、evals、examples 检查全部通过。 |

宿主发现验证只调用初始化与只读 `skills/list`，没有创建模型任务，没有修改信任或权限设置，结束后停止了本次启动的 app-server。Codex 已确认的是项目 Skills／显式命令的发现；完整会话中的入口加载、子代理发现和信任状态仍待确认。当前 Claude Code 为 2.0.31，其配置文件检查已通过，完整会话加载没有执行。doctor 分别保留这些待验证项。

静态命令解析器对 Swift 命令及 Python heredoc 的 4 处声明仍标记为待检查。来源复核与真实执行记录单独保留，文件检查通过不代表这些命令已由静态解析器验证。

此前的原生测试与隔离启动烟测仍保留在[实际演练报告](mori-functional-rehearsal.md)中，不能直接当作新工作区绑定下的执行结果。本次没有重新启动 Mori 服务或替换已安装应用。历史工程任务缺少验证命令的单项警告继续保留。

## Kit 的改进

- 初始化 Skill 将“在实际目标仓库建立可用 Agent 工作环境”作为仓库初始化的主交付；仅文档和临时演练保持独立范围。
- 增加仓库初始化工作流：区分调用位置、参考仓和写入目标；从真实任务推导能力；复用现有工程规则；生成宿主原生文件；验证实际安装结果。
- 新初始化必须明确保存 `harness` 选择，避免把兼容旧版本的文档规划路径当成完整配置。
- 检查报告新增配置清单，区分完整工作环境、仅文档和仅入口。空设置对象无法满足配置要求，检查时也会核对所选能力。
- 中英文 README 对齐新的主流程和实际输出说明，保留中文生成与幂等刷新能力。

初始化前后，Mori 原有的 453 个受跟踪文件中，只有 `AGENTS.md`、任务清单和追加式进度日志发生预期变更；应用源码与已有指南未改变。保留全部 86 个历史任务对象，新增初始化任务已完成。原 HEAD 未改变，没有创建提交或推送。

完整预览、生成配置、32 份审阅、检查结果、Codex 发现记录及保护检查保留在私有本地证据目录。共享[结构化结果](mori-native-bootstrap.json)只记录经过筛选的结果与证据哈希，不包含个人检出路径、账号凭据或原始诊断。
