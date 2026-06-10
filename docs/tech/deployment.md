# Deployment Notes

## 部署形态

项目采用前后端分离部署：

- Frontend：`next-lobster-platform/`，部署到公网 ECS 或同类 Web 服务器。
- Backend：`backend/`，部署到 AutoDL、WSL 机器或其他计算节点。
- WebSocket：后端单独监听 WS 端口，生产环境建议通过 Nginx `/ws` 反向代理。

## 关键环境变量

前端：

```env
NEXT_PUBLIC_API_URL=http://<public-api-host>
NEXT_PUBLIC_WS_URL=ws://<public-ws-host>/ws
BACKEND_INTERNAL_URL=http://127.0.0.1:3002
```

后端：

```env
PORT=3002
WS_PORT=3003
WORKSPACE_ROOT=/opt/openclaw/data/workspaces
JWT_SECRET=replace-with-long-random-secret
PUBLIC_BACKEND_URL=http://<public-api-host>
FEISHU_PUBLIC_BASE_URL=http://<public-api-host>
CORS_ORIGIN=http://<frontend-origin>
```

## Nginx 反向代理

生产环境建议统一公网入口：

- `/` 转发到前端服务。
- `/api`、`/auth`、上传资源转发到后端 HTTP。
- `/ws` 转发到后端 WebSocket。

## 部署验证

每次发布后至少验证：

- `npm run build` 通过。
- 前端首页 HTTP 200。
- 后端 `/health` HTTP 200。
- 登录/注册链路可用。
- WebSocket 能连接。
- 上传和 Agent 对话不再访问 localhost。
- PM2 或进程管理器状态正常。

## 文档来源

完整部署细节保留在根目录 `README.md` 和 `backend/DEPLOY.md`。本文只作为技术文档目录下的简版部署规范。
