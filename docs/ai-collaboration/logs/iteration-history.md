# Iteration History

本文件是面向项目汇报的时间线摘要。更细的 Codex 对话来源见 `codex-session-index.md`。

## 2026-05-24：PRD 与架构方案

AI 根据自然语言需求整理出 Agent 平台 PRD，明确 Web 模式、桌面端模式、Market workspace、User Agent workspace、Team Runtime Workspace、A2AWrapper 和 WSL 目录组织。

## 2026-05-29：Agent 上传与设置

调整上传后 Agent 设置流程，避免浏览器弹窗拦截；恢复中文文案和文件夹/zip 图标；通过前端 build 和页面检查。

## 2026-06-06：前后端分离与 CORS

排查前端端口与后端 CORS 不一致问题，更新允许源并验证注册、登录和预检请求。

## 2026-06-07：团队、Tea Party 与移动端

梳理团队工作台和 Agent Tea Party 的移动端结构，修复返回逻辑、持久化和无意义滚动。

## 2026-06-08：桌面/Web 统一与 Agent runtime

修复 Windows 无 WSL 场景下的 OpenClaw 本机运行路径；修复 OpenClaw 混合输出导致前端展示 raw JSON 的问题；补充 smoke 覆盖。

## 2026-06-09：传统模式布局

新增宽屏传统模式布局，保留原有颜色和风格，仅调整卡片排布、侧边栏和裁切行为；验证桌面与移动端互不干扰。

## 2026-06-10：部署同步与协作记录

同步 GitHub PR、本地分支和部署状态，整理 AI 协作开发记录，并将规范、skills、rules、harness 和 logs 归档到 docs 目录。
