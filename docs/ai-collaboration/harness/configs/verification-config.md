# Verification Config

## 常用验证命令

后端：

```bash
cd backend
npm run build
npm run smoke:runtime-health
npm run smoke:project-crud
npm run smoke:workflow-handoff
npm run smoke:workflow-parallel-handoff
npm run smoke:workflow-condition-branch
npm run smoke:windows-no-wsl
```

前端：

```bash
cd next-lobster-platform
npm run build
npm run smoke:mobile-render
npm run smoke:mobile-ui
npm run smoke:home-projects
```

桌面端：

```bash
cd openclaw-desktop-client
npm run smoke:scan
npm run smoke:renderer
npm run smoke:projects
```

## 验收原则

- 后端行为改动必须至少跑 `npm run build` 和相关 smoke。
- 前端 UI 改动必须浏览器检查桌面和移动端。
- Agent runtime 改动必须验证 Windows 无 WSL 和 OpenClaw 输出解析。
- 部署配置改动必须验证 HTTP、WebSocket、CORS 和登录链路。
