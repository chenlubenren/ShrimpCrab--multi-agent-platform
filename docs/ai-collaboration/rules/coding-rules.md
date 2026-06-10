# Coding Rules

## 基本原则

- 保持改动聚焦，不做无关重构。
- 优先沿用现有架构、命名和组件风格。
- 涉及用户数据、workspace、provider token 的逻辑必须后端处理。
- 前端不得暴露真实模型 Key、gateway token 或敏感路径。
- 上传和解压必须做路径安全校验。

## 前端规则

- 保持桌面端、移动端和传统/专业模式互不干扰。
- 新 UI 要验证宽屏、普通桌面和手机端。
- 布局修复优先改约束、间距和容器行为，不用整体 zoom 规避问题。
- 移动端底部导航和返回逻辑必须回归验证。

## 后端规则

- 路由层保持薄，业务逻辑放在 service 层。
- Agent CLI 输出必须解析为用户可见文本，不能泄露 raw JSON、meta 或 system prompt report。
- Windows 无 WSL 场景必须走本机 CLI，不强制依赖 `wsl bash -lc`。
- WebSocket、CORS、provider 和 workspace 路径必须通过配置控制。

## Git 规则

- 提交前检查 `git status`，只 stage 本次相关文件。
- 不回滚用户未授权改动。
- 文档任务只提交 docs 文件，不夹带代码改动。
- 推送前确认当前分支与远端关系。
