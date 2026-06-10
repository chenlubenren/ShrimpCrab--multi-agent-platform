# Technical Architecture

## 总体分层

```text
Next.js Frontend
  -> Platform API
    -> Auth / DB / Workspace Manager
    -> Agent Runtime
      -> Agent Runner
      -> Workflow Executor
      -> A2A-style Routing
      -> OpenClaw / Codex / Claude Code / OpenCode / Hermes / Coze adapters
```

## 前端

- `next-lobster-platform/`：Next.js 14 + React + Tailwind CSS。
- 负责首页、市场、上传、我的 Agent、项目、团队编排、茶话会、设置和移动端体验。
- 前端只调用 Platform API，不直接持有模型 Key 或 gateway token。

## 后端

- `backend/`：Express + TypeScript + SQLite + WebSocket。
- 负责认证、Agent、市场、项目、团队、工作流、上传、Provider 和运行时健康检查。
- 运行时通过 service 层封装，不让路由直接理解不同 Agent CLI 的内部细节。

## Workspace 模型

```text
Market immutable workspace
  -> User agent solo workspace
    -> Team runtime workspace / workflow run snapshot
```

这条生命周期是平台最重要的技术边界：市场源不可变，用户私有 Agent 可演进，团队运行必须使用隔离副本或项目运行目录。

## 多 Agent 工作流

多 Agent 协作使用 Workflow DSL 描述。DSL 中包含 start、agent、condition、end 节点，支持 prompt-chain、routing、parallelization、competition、orchestrator-workers 和 evaluator-optimizer 等协作模式。

相关实现：

- `backend/src/services/workflow-dsl.service.ts`
- `backend/src/services/workflow-executor.service.ts`
- `next-lobster-platform/src/lib/workflowDsl.ts`

## Agent 运行上下文

后端在运行 Agent 前构造统一 runtime prompt，注入 Agent 配置、workspace 根文档、memory、skills 索引和当前任务模式。不同模式有不同约束：

- direct-chat：单 Agent 对话，使用 persona、memory 和 skills。
- group-chat：多 Agent 群聊，只使用人格和对话上下文，不执行 skills。
- workflow：工作流节点，只完成当前节点任务，结果通过 artifacts 和 handoff 传递。

相关实现：

- `backend/src/services/agent-runtime-context.service.ts`
- `backend/src/services/agent-runner.service.ts`

## 桌面端

`openclaw-desktop-client/` 提供 Electron 桌面壳和本地桥接能力，扫描本机 Agent workspace，并把桌面模式接入同一套 Web UI。
