# Workflow DSL Prompt Template

## 用途

将用户的自然语言团队需求转换为严格 JSON Workflow DSL。

## 约束摘要

- 只返回 JSON，不返回 Markdown。
- `schemaVersion` 固定为 `1.0`。
- 节点类型限定为 `start`、`agent`、`condition`、`end`。
- Agent kind 限定为 `worker`、`router`、`aggregator`、`judge`、`orchestrator`、`evaluator`、`optimizer`。
- 条件分支使用 `yes` / `no`。
- 使用稳定 ASCII id。
- 设置 `metadata.collaborationPattern`。

## 当前实现位置

`backend/src/services/workflow-dsl.service.ts`

## 后续要求

修改该提示词时，需要同步检查：

- DSL normalize 是否兼容。
- 前端画布是否能渲染。
- workflow smoke 是否通过。
