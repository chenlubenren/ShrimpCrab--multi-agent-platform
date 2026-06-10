# Spec: Agent Team Workflow

## 规范地位

本文件是团队编排和多 Agent 工作流的核心 spec。后续 AI 或人工开发涉及团队创建、自然语言生成团队、画布编排、工作流执行、节点 handoff、artifacts 收集时，优先遵循本文件。

## 核心对象

- Team / Architecture：用户保存的团队结构，描述成员、节点、连线和运行策略。
- Workflow DSL：团队运行时的结构化描述，包含节点、边、执行模式和元数据。
- Workflow Execution：一次团队任务运行，记录节点状态、事件、产物和最终输出。
- Artifact：节点输出或 workspace 文件，作为下游节点和用户查看的交付物。

## Workflow DSL 要求

DSL 必须满足：

- `schemaVersion` 为 `1.0`。
- 至少包含一个 `start` 节点和一个 `end` 节点。
- 节点类型限定为 `start`、`agent`、`condition`、`end`。
- Agent 节点的 `kind` 可为 `worker`、`router`、`aggregator`、`judge`、`orchestrator`、`evaluator`、`optimizer`。
- 条件节点输出边必须使用 `yes` 或 `no` 分支。
- 节点 id 使用稳定 ASCII，例如 `node-start`、`agent-researcher`、`condition-review`、`node-end`。
- `execution.maxConcurrency` 必须大于等于 1。
- `state-machine` 模式必须设置合理的 `maxIterations`。

## 协作模式

平台支持以下模式：

- prompt-chain：多个 Agent 顺序处理任务。
- routing：路由或条件节点决定下游路径。
- parallelization：多个上游 Agent 并行，再由聚合节点汇总。
- competition：多个候选输出由 judge 节点评审。
- orchestrator-workers：管理节点拆解任务并分发给 worker。
- evaluator-optimizer：评估与优化节点循环迭代。

## 运行原则

- 团队运行不直接修改 Market workspace。
- 团队运行不直接污染成员 Agent 的 solo workspace。
- 团队运行应使用项目共享 workspace 或独立 runtime workspace。
- 上游节点若产出可复用内容，应写入真实文件，并在结果中说明路径。
- 下游节点必须读取 upstream output 和 artifact preview 后继续处理。
- Agent 节点只完成本节点任务，不主动执行下游节点。

## 失败与回退

- 单节点失败时，execution 应标记为 failed，并记录失败节点和错误信息。
- 未绑定真实 Agent 或 CLI 不可用时，可进入 fallback handoff，但必须保留原因。
- 条件分支未命中时，应有安全默认路径，避免 workflow stalled。

## 验证要求

涉及本 spec 的改动至少运行相关 smoke：

- `smoke-workflow-handoff`
- `smoke-workflow-parallel-handoff`
- `smoke-workflow-condition-branch`
- `smoke-workflow-project-handoff`
- `smoke-http-workflow-handoff`
