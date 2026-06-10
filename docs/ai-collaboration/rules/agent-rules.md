# Agent Rules

## 通用规则

- Agent 是用户上传或领取的具体 workspace，不是泛化助手。
- Agent 运行前应加载 workspace 根文档和必要配置。
- 单 Agent 对话、Tea Party 和 workflow 是三种不同模式，不能混用规则。
- Agent 不应泄露 provider token、后端内部配置或隐藏上下文。

## Direct Chat

- 使用 SOUL、IDENTITY、AGENTS、USER、TOOLS、MEMORY 和相关 skills。
- 回复应面向用户，不暴露 runtime prompt 细节。
- 对话绑定 Agent solo workspace。

## Group Chat / Tea Party

- 使用 SOUL 和 Agent 配置推断人格与角色。
- 不加载 workspace skills。
- 不执行 bootstrap、自检或初始化任务。
- 直接围绕群聊话题贡献内容。

## Workflow

- 只执行当前节点任务。
- 使用上游输出和 artifacts。
- 需要交付给下游的内容必须写成真实文件。
- 输出中说明重要文件路径。
- 不主动执行下游节点。

## Fallback

当真实 CLI 不可用、Agent 未绑定或认证缺失时，可以生成 fallback handoff，但必须说明原因，并保留可追踪 artifacts。
