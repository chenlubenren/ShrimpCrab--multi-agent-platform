# Skill List

## Codex 侧已使用技能

- `autoresearch-agent`：用于可度量目标的持续优化循环。
- `loop`：用于按固定间隔重复运行长任务。
- `handoff`：用于长任务中断、上下文压缩和跨会话交接。
- `self-improving-agent`：用于把经验沉淀为长期规则或技能。
- `playwright` / browser 验证能力：用于前端页面、交互和布局检查。

## 项目内 Agent skill 机制

平台支持在 Agent workspace 内放置 `skills/SKILL.md`，并由后端扫描、上传、展示和注入运行时上下文。

关键实现：

- `backend/src/services/agent-skills.service.ts`
- `backend/src/services/agent-runtime-context.service.ts`
- `next-lobster-platform/src/lib/skillOptions.ts`

## 使用约定

- 当用户请求明显匹配某个 skill 时，Agent 应先读取对应 `SKILL.md`，再执行专业任务。
- group-chat 模式不注入 skills，避免聊天场景误触发任务执行。
- workflow 模式可以读取 skill，但只完成当前节点任务。
- skills 是能力说明和操作规范，不应包含明文密钥。

## 后续沉淀方向

- 为前端布局验证沉淀 UI skill。
- 为部署排障沉淀 deployment skill。
- 为工作流 DSL 生成和审查沉淀 workflow-spec skill。
- 为 Agent 上传安全检查沉淀 upload-review skill。
