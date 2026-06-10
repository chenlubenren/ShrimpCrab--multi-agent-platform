# Development Notes

## 记录方式

本文件记录 AI 协作开发中的关键判断和经验，不替代 spec。稳定规则应沉淀到 `docs/ai-collaboration/specs/` 或 `docs/ai-collaboration/rules/`。

Codex 原始 session 不直接入库。项目只维护 `codex-session-index.md` 这类摘要索引，避免泄露系统提示、密钥、本机路径或终端完整输出。

## 当前关键经验

- PRD 和技术方案先行，有助于避免多 Agent 平台概念漂移。
- Workspace 生命周期必须清楚，否则单 Agent 对话、团队运行和市场发布容易互相污染。
- Windows、WSL、ECS、AutoDL 混合部署时，路径和端口是最常见问题源。
- OpenClaw CLI 输出可能混入 warning 和 JSON，需要后端提取用户可见文本。
- 前端宽屏、移动端、桌面端壳共用一套 UI 时，布局改动必须做多视口回归。
- 文档任务应只提交 docs，避免夹带代码变更。
- 当用户允许使用全部 Codex session 时，应优先提炼“目标、行动、验证、产物”，而不是复述原始对话。

## 待继续沉淀

- 市场化供给质量指标。
- 创作者收益分成规则。
- 官方 Key 与 Token 中转计量规则。
- 多服务器 worker 调度规范。
- Agent 安全审核 checklist。
