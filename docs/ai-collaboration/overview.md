# AI Collaboration Overview

## 7.3 AI 协作产物与所在位置

本项目的 AI 协作产物按 `product`、`tech` 和 `ai-collaboration` 三类组织。其中 `ai-collaboration/specs/` 是最重要的协作规范目录，后续涉及 Agent、团队、项目、茶话会和运行时行为的开发，均应先参考 spec，再修改代码。

Codex 对话 session 是本目录的重要来源，但仓库只保存摘要和规范，不保存原始 session。项目相关 session 的摘要索引见 `logs/codex-session-index.md`。

## 目录说明

```text
docs/
  product/              # 产品说明与演示脚本
  tech/                 # 技术架构与部署说明
  ai-collaboration/     # AI 协作记录、规范、skills、rules、harness 和日志
```

## AI 协作方式

项目开发过程中，AI 在多个阶段参与：

- 产品概念阶段：根据自然语言描述沉淀 PRD、架构方案和 WSL/部署建议。
- 设计阶段：将多 Agent 协作抽象为 Market、User Agent、Team Runtime Workspace、A2AWrapper、Workflow DSL 等模块。
- 实现阶段：直接修改前后端代码，覆盖上传 Agent、单 Agent 对话、团队编排、桌面/Web 统一、移动端与宽屏布局等功能。
- 调试阶段：通过日志、构建、smoke 脚本和浏览器验证定位 CORS、Windows 无 WSL 运行、OpenClaw JSON 输出污染等问题。
- 部署阶段：辅助完成前后端分离部署、环境变量配置、Nginx 反向代理、PM2 状态检查、线上健康检查和 GitHub 同步。

## 规范优先级

AI 协作时的优先级如下：

1. `docs/ai-collaboration/specs/`：业务和运行时行为规范。
2. `docs/ai-collaboration/rules/`：编码、文档和 Agent 使用约定。
3. `docs/ai-collaboration/harness/`：提示词、配置和验证模板。
4. `docs/ai-collaboration/logs/`：Codex session 摘要、开发记录和迭代历史。
5. 代码实现和已有 README。

如果代码行为和 spec 不一致，需要先判断是代码偏离规范，还是规范已经过期。默认不直接重写 spec，而是先在迭代记录中说明差异。
