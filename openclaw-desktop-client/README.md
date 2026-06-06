# OpenClaw Desktop Client

This is the desktop shell for OpenClaw. It keeps the wide web layout style, but adds a local-only Agent import flow for scanning the current user's computer.

## Current Capabilities

- Wide desktop shell that can load the local web app.
- Local Agent scanner for five workspace families:
  - Claude Code
  - Codex
  - OpenCode
  - Hermes
  - OpenClaw
- OpenClaw scanning handles its nested organization differently, including `data/workspaces/users/<user>/agents/<agent>/workspace` and `~/.openclaw/workspace*` style directories.
- Local folder reader that prepares files for the backend `/api/upload` endpoint.
- Real local import flow: select a scanned Agent, fill name/description, paste an auth token, and import it into "我的 Agent 窝".

## Commands

```powershell
npm run scan
```

```powershell
npm install
npm run dev
```

Set this when you want the desktop shell to load the existing Next.js app directly:

```powershell
$env:OPENCLAW_DESKTOP_WEB_URL="http://localhost:3000"
npm run dev
```

## Import Notes

1. Start the backend and web app.
2. Log in on the web app and copy the auth token for now.
3. Start the desktop client, scan the user directory, select a local Agent, then click "导入到我的 Agent 窝".

The desktop client now calls the real backend upload endpoint. It still needs a pasted auth token because the desktop login/session bridge is not implemented yet.
