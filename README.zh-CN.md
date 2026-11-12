# Workspace Harness Kit

[English](README.md) · 简体中文

**为仓库初始化专属 Agent 工作环境，并连接跨仓启动、测试与交付证据。**

可以从空目录起步、接入单个已有仓库，或将多个仓库纳入同一个工作区。产品、设计、开发、测试、运维、市场、商务拓展和支持可以通过同一个入口查询仓库、测试和发布证据。

## Skills

| Skill | 用途 |
| --- | --- |
| [harness-init](skills/harness-init/SKILL.md) | 了解背景、仓库和平台，准备工具链，按来源生成指南及 Codex / Claude Code 原生配置。 |
| [harness-guide](skills/harness-guide/SKILL.md) | 从自然语言任务定位仓库、操作手册、负责人或交付证据。 |
| [harness-setup-local](skills/harness-setup-local/SKILL.md) | 检查本地前置条件，沿用项目已有命令，启动选定场景并执行应用烟测。 |
| [harness-test](skills/harness-test/SKILL.md) | 按范围选择并执行跨组件检查，记录实际测试的环境、版本与结果。 |
| [harness-verify-release](skills/harness-verify-release/SKILL.md) | 评估发布前就绪状态，核对部署执行、实测运行制品、技术烟测和业务验收。 |

## 快速开始

把完整 Skill 文件夹安装到 Agent 配置的技能目录，也可以让 Agent 直接读取此检出中的对应 `SKILL.md`。辅助工具需要 Node.js 24 或更新版本，工作区发现还需要 Git。仓库已包含可直接运行的 `.mjs` 产物，无需 npm 安装或 TypeScript 编译器。本地启动与验证还需要目标项目要求的工具。

使用版本化安装时，将 `SKILLS_DIR` 设为 Agent 配置的技能目录，`INSTALL_PLAN` 设为本地临时文件：

```sh
node scripts/install.mjs --version
node scripts/install.mjs plan --destination "$SKILLS_DIR" > "$INSTALL_PLAN"
node scripts/install.mjs apply --plan "$INSTALL_PLAN"
node scripts/install.mjs check --destination "$SKILLS_DIR"
```

应用前查看计划。添加 `--skill harness-init` 可只安装指定 Skill。升级时从目标版本的检出重新运行 plan/apply。安装器会复制支持文件、记录版本与哈希，并拒绝覆盖非本工具管理的目录或本地修改；明确处理冲突后重新生成计划。它不会修改 Agent 设置或安装全局依赖。详见[安装与兼容性](docs/installation.md)。

1. 在空目录、单个 Git 仓库或包含多个仓库的父目录中开始。
2. 对 Agent 说：**「在当前仓库使用 harness-init，初始化完整的 Codex 和 Claude Code 工作环境。根据源码生成项目工作流、命令、子代理、规则和指南，覆盖开发与测试，按需询问部署和运维需求。」**
3. Agent 先提示文档语言选择（英文或简体中文），已有明确选择时展示并复用。随后只追问缺失信息：先确定需要哪些工作，再按需询问 AWS、Azure、Google Cloud、其他平台或多平台，以及服务、环境和现有流程。仅本地开发时跳过云平台问题。
4. 逐仓选择，也可以选中整目录的候选再排除部分仓库，或添加外部检出。对每个成员选择**仅登记、分析或初始化**，并确定配置集中保存还是放在成员仓中。选择 Codex、Claude Code 或两者，再选择需要的文档、Skills、commands、agents、rules、settings、hooks 和 CI。
5. 查看已确定的范围、工具操作与拟生成的文件。Agent 检查已有工具，在所请求的初始化范围内安装缺失项、协助登录并验证目标访问。也可以选择仅检查或仅编写文档；已有授权和偏好会被复用。
6. Agent 分析服务边界和业务流程，编写所选操作流程，按所选布局生成配置并检查产物。在实际 Agent 会话中验证加载与信任状态，分别报告托管 CI 和应用执行结果。之后可以继续问：**「用 harness-guide 查询结账功能的发布状态」**，或**「用 harness-setup-local 启动 API 和依赖服务」**。

初始化会列出 harness 文档目录外的现有文档、拟迁入路径与受影响引用，询问哪些迁入、哪些保留。已保存的逐文档选择会被复用，辅助工具不会自动移动文档。专用 Skill 和入口符号链接保留原有行为。仅在选择对应工作时加入部署、运维指南。工具安装、身份登录、目标访问、应用执行分别报告结果。再次初始化会复用已保存的选择，处理缺失或变化的部分。详见[渐进式初始化流程](skills/harness-init/references/onboarding.md)和[生成流程及原生 Agent 适配](skills/harness-init/references/generation.md)。

新仓库初始化优先使用 `layout: "centralized"`：指南、工作流、规则及生成状态统一保存在 `.harness/`，根目录只有一份 `AGENTS.md` 正文；选择 Claude Code 时生成 `CLAUDE.md -> AGENTS.md` 相对软链。Agent 通过入口读取共享流程，这种布局不注册原生 Skills、斜杠命令或子代理，也不生成原生设置、hook 和 CI。

仓库内的文档和工作流按用途使用简短名称，例如 `architecture.md`、`engineering`、`local-dev`、`verify`、`resume`，不重复添加仓库名前缀。只有共享工作区中确实需要区分不同组件的流程时，才添加组件限定词。

需要宿主原生集成时选择 `layout: "native"`，使用 Codex 的 `.agents/skills/`、`.codex/agents/`、Claude Code 的 `.claude/` 及原有文档布局。旧配置未指定 layout 时继续保持原生布局。两种方式都写入实际选择的仓库并验证产物，临时演练单独报告。详见[仓库初始化工作流](skills/harness-init/references/repository-bootstrap.md)。

本项目的 Skill、模板和技术文档使用英文，同时提供这份中文版 README。初始化时明确提示选择英文（`en`）或简体中文（`zh-CN`）；未选择时保留为待回答，刷新时展示并复用已保存的选择。已有文档保留原语言和原文，除非用户要求翻译。旧生成规格没有语言字段时，渲染器继续使用英文默认值。

生成中文内容时，在初始化配置和 harness 生成规格中均保存 `language: "zh-CN"`，使受管入口说明在每次刷新后继续使用中文。编写的指南和描述遵循所选语言，命令与标识符保留原文。

生成的入口会约束后续所有由 AI 新增的项目文档，包括计划、设计、分析、验证报告和交接记录，统一放入所选 harness 文档目录，通常为 `.harness/docs/`。生成规格的 `documentation_root` 须与初始化配置的 `documentation.root` 一致；目录内维护索引，对选择保留原位的文档使用链接。工具要求的文件按自身约定存放。这是 Agent 行为规则，不是文件系统权限限制。

## 工作区辅助工具

工作区辅助工具发现 Git 仓库、预览选择、写入共享索引与本机映射，并检查索引。Agent 负责复核来源并编写生成规格，独立的生成器据此输出和检查所选原生配置。两种辅助工具均可脱离 Agent 运行。

从本仓根目录运行。将 `PROJECTS`、`WORKSPACE`、`PLAN` 分别设为包含成员仓的目录、已存在的工作区目录，以及可写的计划文件路径。

```sh
helper=skills/harness-init/scripts/workspace.mjs
node "$helper" discover --directory "$PROJECTS" --depth 2
node "$helper" plan --workspace "$WORKSPACE" --language zh-CN \
  --member api init "$PROJECTS/api" \
  --member website analyze "$PROJECTS/website" > "$PLAN"
node "$helper" apply --plan "$PLAN"
node "$helper" check --workspace "$WORKSPACE" --local
```

计划文件可能包含本机绝对路径，请保存在本地。共享索引位于 `.harness/workspace.json`，被 Git 忽略的 `.harness/workspace.local.json` 保存仓库 ID 到本机检出的映射。需要团队共享时，可以选用已有 Git 仓保存共享索引。

根据背景进行初始化时，将脱敏后的选择保存为 JSON 配置：

```sh
node skills/harness-init/scripts/onboarding.mjs plan "$PROFILE"
node skills/harness-init/scripts/onboarding.mjs tools "$PROFILE"
node "$helper" plan --workspace "$WORKSPACE" --profile "$PROFILE" > "$PLAN"
```

可以从 `{"schema_version":1}` 草稿开始，也可以修改[合成 AWS 示例](skills/harness-init/assets/onboarding-aws.json)。`plan` 输出待确认的问题、工具和文档主题；`tools` 只执行本地版本检查。安装、登录和文档编写由 Agent 执行。工作区 apply 将配置保存为 `onboarding`，省略 `--profile` 会保留已有选择。选择变化后，旧文档复核会变为待确认。计划完整不代表初始化已执行；凭据和本机就绪状态保存在既有本地存储中。

需要 Agent 配置时，在初始化配置中添加 `harness.targets` 和 `harness.artifacts`。基于实际项目来源和所选流程改写[完整合成规格](skills/harness-init/assets/harness-complete.json)，将 `SPEC`、`HARNESS_PLAN` 分别设为编写好的规格文件和本地预览文件：

```sh
generator=skills/harness-init/scripts/harness.mjs
node "$generator" plan --workspace "$WORKSPACE" --spec "$SPEC" > "$HARNESS_PLAN"
node "$generator" apply --plan "$HARNESS_PLAN"
node "$generator" check --workspace "$WORKSPACE" --local
```

预览包含完整文件内容与冲突。应用时保留入口中的手写内容、合并支持的设置；已被修改或非本工具管理的产物需要明确处理。共享规格和文件管理记录保存在 `.harness/`。生成的 Node 检查脚本与字面命令匹配 hooks 无需 Kit 或 npm 依赖即可运行。可选 GitHub Actions CI 检查配置产物和 hook 用例，也可添加有项目来源的检查命令。产物检查通过不代表 Agent 已加载配置或托管 CI 已运行。规格、更新行为、原生格式和激活检查详见[生成流程](skills/harness-init/references/generation.md)。

选择生成文档后，`check` 会检查所选活动的必要主题是否有非空内容，并校验本地 Markdown 链接、引用和标题锚点。已有的综合指南可用 `document_coverage` 显式映射主题。覆盖检查不证明内容真实；仍需复核来源并实际执行文档中的流程。

`check` 还会检查文档中明确写出的 package scripts、Make target 和脚本路径，但不执行它们。成员仓及子目录命令需要显式声明工作目录。空仓首次交付中尚未实现的命令可标为 `phase: "planned"` 并说明原因；实现和复核后再改为当前命令检查。不支持或动态生成的调用也保持待确认。以下命令分别提供来源影响分析、只读副本漂移检查和分层执行证据：

```sh
node "$generator" impact --workspace "$WORKSPACE" --local
node "$generator" sync --workspace "$WORKSPACE" --local
node "$generator" doctor --workspace "$WORKSPACE"
node "$generator" doctor --workspace "$WORKSPACE" --run-probe greeting-smoke
```

Doctor 只执行从已复核规格中逐项选定的探针，分别报告产物、原生 Agent/hook 激活、工具、目标访问、CI 和应用烟测。证据具有有效期，并绑定配置与本机映射；不保留原始进程输出。宿主激活需要实际会话证据。可选的逐产物来源映射缩小影响范围，未声明映射的产物继续保守依赖全部来源。`sync` 不写入成员仓。详见[验证契约与示例](skills/harness-init/references/verification.md)。

完成最终文档编辑与来源复核后，使用 `--review-document api docs/harness/development.md` 生成新计划。通过 `--source api scripts/start.sh` 纳入项目特有来源文件。应用后运行 `check --local --strict`。普通扫描更新来源观察记录，但保留文档复核基线；新增来源和复核输入变化仍会被报告。指纹有效只表示内容自复核后未变，不代表文档中的命令已经执行。详见[复核流程](skills/harness-init/references/workspace.md#document-review-and-freshness)。

可选的[组件、业务能力和带类型关系](skills/harness-init/references/registry.md)可以描述同一仓库中的多个部署组件。启动和部署顺序中的循环会被拒绝；未显式定义组件的成员仓继续使用一个默认组件。

## 发布证据

发布 Skill 提供可独立运行的 Node.js 判定器，读取版本化 JSON 记录，将预期范围与实际观察分开，并检查目标身份、制品身份、新鲜度、必需组件和重试历史：

```sh
node skills/harness-verify-release/scripts/evidence.mjs "$RECORD"
node skills/harness-verify-release/scripts/evidence.mjs "$RECORD" --format markdown
node skills/harness-verify-release/scripts/evidence.mjs "$RECORD" --workspace "$WORKSPACE"
```

退出码为 `0` 通过、`1` 失败、`2` 待确认或输入无效；JSON 会区分后两种情况。缺失观察、跳过部署和不可比较的制品身份不能通过。组件业务检查现在与技术检查一样要求实际测试的制品身份；旧 v1 记录仍可读取，但缺少身份的业务通过记录会变为待确认。`--workspace` 会检查业务能力的成员范围，包括传递的 `requires` 关系。只读采集器支持 GitHub Actions 导出 job 中的指定步骤、JSON 运行身份端点、JUnit 报告及有界的 AWS ECS 运行 manifest 采集。详见[证据契约与采集器](skills/harness-verify-release/references/evidence-format.md)。

部署前可运行 `whk readiness --plan FILE [--record FILE]`，或独立的 `skills/harness-verify-release/scripts/readiness.mjs`，按项目范围评估制品、回滚、迁移、监控和复核证据。它绑定精确目标与预期制品，保留重试历史，输出 ready/not-ready/pending，不执行部署或授予权限。详见[发布就绪检查](skills/harness-verify-release/references/readiness.md)。

实际事实与所需审批仍以项目来源系统为准。判定器校验提供的证据，不认证外部引用、不执行部署，也不批准发布。

## 示例与开发

- [多仓示例](examples/README.md)
- [工作区、权限和证据设计](docs/design.md)
- [Skill 行为评测场景](evals/README.md)

共享核心使用严格 TypeScript，文件系统、Git、HTTP、TOML 和 XML 适配器独立组织。库调用方可以导入 `evaluate`、`validateManifest`，`whk` CLI 使用同一套实现。详见 [Node 架构、打包与迁移](docs/node-runtime.md)。

在源码检出中安装开发工具并运行：

```sh
npm ci
npm run check:bundles
npm test
npm run check:examples
npm run check:evals
npm run check:package
```

合成示例需要 Python 3.11+ 和 Git，从独立仓库运行 API、客户端和 worker。它在协调目录生成两种 Agent 的配置，验证产物和 hook 用例，通过 doctor 执行真实应用烟测，并使用安装后的 Node 判定器验证正常、健康旧版本、跳过部署、业务失败四种结果。评测包提供十二个隔离发布场景及支持对照实验指标的评判工具；场景检查不等于实际 Agent 运行，也不能证明跨模型性能。核心测试使用 Node 内置测试运行器，并保留原 Python 判定器的九个完整结果指纹。

各项目继续提供自己的部署控制、凭据和应用验证入口。真实托管环境的部署与验收结果必须来自目标项目的实际环境。

[本地文档验证报告](evals/harness-docs-validation.md)记录了空仓、已有服务和多仓场景的独立编写与阅读执行、Node 24 复验、发现的问题，以及文档结构检查的适用边界。

## 许可证

[MIT](LICENSE)
