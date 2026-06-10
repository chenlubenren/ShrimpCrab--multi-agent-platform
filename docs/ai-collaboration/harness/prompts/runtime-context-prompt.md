# Runtime Context Prompt Template

## 用途

在真实运行 Agent 前，把 workspace 文档、skills、provider 配置和任务模式组织为统一 runtime context。

## 注入内容

- Agent instance id、name、description。
- Platform、workspace path、state dir。
- Provider id、type、base URL、selected model。
- Manifest 摘要。
- 根文档：SOUL、IDENTITY、USER、AGENTS、TOOLS、MEMORY。
- 最近 memory。
- skills index。
- 相关 skill excerpt。
- 用户消息。

## 模式差异

- direct-chat：完整加载 persona、memory 和 skills。
- group-chat：只加载人格和会话上下文，不加载 skills。
- workflow：加载 persona 和 skills，但只完成当前节点任务。

## 当前实现位置

`backend/src/services/agent-runtime-context.service.ts`
