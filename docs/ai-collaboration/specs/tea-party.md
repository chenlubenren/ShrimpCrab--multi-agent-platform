# Spec: Tea Party

## 规范地位

本文件规定 Agent Tea Party 的群聊协作行为。Tea Party 与正式 workflow 不同，它强调轻量讨论、角色表达和多人协同，不应触发完整任务执行链。

## 核心对象

- Tea Party Session：一次多 Agent 群聊会话。
- Session Messages：群聊消息记录。
- Whiteboard：群聊中沉淀的共享草稿、要点或结论。
- Participants：参与群聊的用户和 Agent。

## 行为原则

- Tea Party 是群聊协作，不是 workflow executor。
- Agent 应根据 SOUL、配置描述和当前话题参与讨论。
- 群聊中不执行 workspace skills。
- 群聊中不要求 Agent 做 bootstrap、自检或初始化。
- Agent 不应反复声明自己在线、未初始化或缺少身份文件。
- 若身份信息不足，基于 Agent 名称、描述和 SOUL 风格推断稳定角色。

## 存储原则

- 会话、消息和白板应持久化。
- 用户返回 Tea Party 时应能看到之前会话。
- 移动端 Tea Party 与团队工作台并列，不从属于某个团队运行。

## UI 原则

- 移动端 Tea Party 入口应清晰独立。
- 返回逻辑优先走浏览器历史；无历史时回到对应移动 tab。
- Tea Party 不应影响单 Agent 对话和正式团队运行。

## 验证要求

涉及 Tea Party 的改动至少验证：

- 新建会话。
- 发送消息。
- 刷新后记录仍在。
- 移动端返回路径正确。
- 不影响团队详情和单 Agent 页面。
