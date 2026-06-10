# Spec: Project Workspace

## 规范地位

本文件规定项目空间、Agent workspace 和团队运行空间的边界。任何涉及项目文件管理、上传、运行时写文件、artifacts 收集和 workspace 路径解析的开发，都应先参考本 spec。

## Workspace 生命周期

```text
Market immutable workspace
  -> User agent solo workspace
    -> Project shared workspace
      -> Workflow run workspace
        -> Artifacts / handoff files
```

## 目录语义

- Market workspace：市场发布源，发布后不可变。
- User agent solo workspace：用户自己的 Agent 副本，可用于单 Agent 对话和后续编辑。
- Project shared workspace：项目文件、上下文、需求和团队运行共享空间。
- Workflow run workspace：一次工作流运行的隔离目录。
- Artifacts：节点输出、交付文件和运行记录。

## 权限原则

- 用户只能访问自己的项目、Agent、团队和运行记录。
- 前端不应暴露真实敏感路径或 provider token。
- 后端负责解析、校验和转换 Windows/WSL 路径。
- 上传内容必须防止路径穿越、绝对路径和 Windows drive path 注入。

## 写入原则

- 单 Agent 对话默认写入该 Agent 的 solo 语境，不写团队 runtime。
- 团队运行写入 project shared workspace 或 workflow run workspace。
- 可交付结果必须保存为真实文件，而不是只留在聊天文本里。
- 运行产生的文件应被 artifacts 收集，供前端和下游节点使用。

## 忽略规则

收集 artifacts 时应忽略：

- `.git/`
- `.openclaw/` 内部运行状态
- `node_modules/`
- `.next/`
- `dist/`
- `build/`

## 验证要求

涉及项目空间的改动至少验证：

- 项目创建、列表、详情和删除。
- 文件预览和路径安全。
- 工作流节点写入文件后能生成 artifact。
- 下游节点能看到 artifact preview。
- Windows 和 WSL 路径都能被正确解析。
