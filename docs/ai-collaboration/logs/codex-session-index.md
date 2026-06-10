# Codex Session Index

## 用途

本文件根据本项目开发过程中与 Codex 的对话 session 整理而成，用于说明 AI 协作记录的来源、覆盖阶段和沉淀产物。仓库只保存摘要，不保存原始 session 内容。

## 记录边界

- 原始 session 保存在本机 Codex 会话目录，由 Codex Desktop 自动维护。
- 本仓库只记录项目相关摘要、时间线和产物位置。
- 不提交原始 session、系统提示、账号凭证、API Key、本机敏感路径或终端完整输出。
- 当 session 中包含密钥、服务器信息或个人路径时，只记录“配置过模型供应商/部署环境”等抽象结论。

## 已纳入的项目 session

| 时间 | Session 主题 | 主要贡献 | 沉淀位置 |
| --- | --- | --- | --- |
| 2026-03-29 | 本地 OpenClaw 主 Agent 聊天项目 | 验证本地前端 + Node 后端 + OpenClaw CLI 的最小聊天链路，为后续 Agent 平台提供早期原型经验 | 后续体现在 Agent Runner 与单 Agent 对话设计中 |
| 2026-05-21 | 网关计算架构讨论 | 明确公网 Gateway 与本地/计算节点分工，形成“公网入口 + 计算节点执行 + 多 Agent 协作”的部署想法 | `docs/tech/architecture.md`、`docs/tech/deployment.md` |
| 2026-05-23 | 自进化 skill 调研 | 安装并确认 `autoresearch-agent`、`loop`、`handoff`、`self-improving-agent` 等技能组合，形成长任务、断点恢复和经验沉淀思路 | `docs/ai-collaboration/skills/skill-list.md` |
| 2026-05-24 | WSL 环境与 PRD 梳理 | 将自然语言想法整理为 PRD、workspace 生命周期、A2AWrapper、API 草案和 WSL 目录建议 | `docs/agent-platform-prd.md`、`docs/ai-collaboration/specs/*` |
| 2026-05-26 | WSL 工具链配置 | 配置 OpenClaw、OpenCode、Codex、Claude Code、Hermes 等本地 AI 开发工具，形成多工具协作环境 | `docs/ai-collaboration/skills/skill-list.md`、`docs/ai-collaboration/rules/agent-rules.md` |
| 2026-05-29 | Agent 对话接入修复 | 修复上传后 Agent 设置流程、中文 UI、图标展示和前端构建问题 | `docs/product/demo-script.md`、`docs/ai-collaboration/logs/iteration-history.md` |
| 2026-05-29 | Git 配置解释 | 梳理本地分支、远端分支、tracking branch、push/pull/fetch 的使用方式 | `docs/ai-collaboration/rules/coding-rules.md` |
| 2026-05-30 | Codex 与 Pi Agent 能力判断 | 对比不同 AI 工具能力边界，为后续 workflow 生成和 fallback 路径提供参考 | `docs/ai-collaboration/harness/prompts/workflow-dsl-prompt.md` |
| 2026-05-30 | Pi Agent 配置 | 完成本地 AI Agent 工具配置，形成多模型/多 CLI 的实验环境 | `docs/ai-collaboration/harness/configs/verification-config.md` |
| 2026-05-31 | 前后端项目启动 | 启动并观察前后端项目，确认本地开发链路与基础页面 | `docs/tech/deployment.md` |
| 2026-06-06 | 需求完成情况检查 | 对已实现功能进行完成度检查，并用 smoke 验证多 Agent 交接链路 | `docs/ai-collaboration/harness/configs/verification-config.md` |
| 2026-06-06 | 前后端分离部署评估 | 排查 CORS、登录、端口和后端配置问题，形成部署检查经验 | `docs/tech/deployment.md`、`docs/ai-collaboration/logs/development-notes.md` |
| 2026-06-07 | 我的项目页面优化 | 修复 Agent 动效、飞书入口和前端页面验证流程 | `docs/product/demo-script.md` |
| 2026-06-08 | 团队与单 Agent 问题修复 | 梳理团队工作台、Tea Party、移动端返回、持久化和单 Agent 边界 | `docs/ai-collaboration/specs/tea-party.md`、`docs/ai-collaboration/specs/agent-team-workflow.md` |
| 2026-06-08 | 前后端分离上线规划 | 推动线上构建、提交、推送、ECS 发布和首页 200 验证 | `docs/tech/deployment.md` |
| 2026-06-08 | 桌面端与 Web 统一性检查 | 修复 Windows 无 WSL 场景下的本机 CLI 调用、runtime health 和 npm shim 问题 | `docs/ai-collaboration/rules/agent-rules.md`、`docs/ai-collaboration/harness/configs/verification-config.md` |
| 2026-06-08 | 手机端创建团队与引导修复 | 修复移动端团队创建、引导、浏览器验证和 OpenClaw 输出解析问题 | `docs/ai-collaboration/specs/agent-team-workflow.md` |
| 2026-06-08 | 分支情况查看 | 解释 Git 分支、远端跟踪关系和本地工作区状态 | `docs/ai-collaboration/rules/coding-rules.md` |
| 2026-06-09 | 传统模式布局 | 新增宽屏传统模式布局，验证不影响手机端和 loading 状态 | `docs/product/demo-script.md`、`docs/ai-collaboration/logs/iteration-history.md` |
| 2026-06-10 | 同步已合并 PR 到本地 | 梳理 PR 合并后本地同步、分支清理、部署与发布检查流程 | `docs/tech/deployment.md` |
| 2026-06-10 | 合并团队协作更新 | 对比另一个功能更新版本，强调合并时保留当前首页 UI、沙箱设置和最小改动原则 | `docs/ai-collaboration/rules/coding-rules.md` |
| 2026-06-10 | AI 协作开发记录整理 | 汇总 AI 协作方式、规范沉淀、产物位置和 docs 组织方式 | `docs/ai-collaboration/overview.md` |

## 从 session 提炼出的稳定规范

- Spec 优先：涉及团队、项目、Tea Party 和 Agent runtime 的开发，先查 `docs/ai-collaboration/specs/`。
- Workspace 边界优先：Market、User Agent、Project、Workflow Run 不混写。
- 运行模式分离：direct-chat、group-chat、workflow 使用不同上下文和行为约束。
- 验证先行：Agent runtime、workflow、移动端、部署和桌面端改动必须有对应 smoke 或浏览器验证。
- 安全默认：密钥、token、系统提示和 raw CLI meta 不进入前端、不进入文档、不进入 Git。

## 后续维护方式

每次完成较大 session 后，按以下方式更新：

1. 在 `iteration-history.md` 增加面向项目的时间线。
2. 在本文件补充 session 主题、主要贡献和沉淀位置。
3. 若形成稳定规则，更新 `specs/` 或 `rules/`。
4. 若只是过程经验，更新 `development-notes.md`。
