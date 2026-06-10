# Documentation Rules

## 文档结构

文档按以下层级组织：

- `docs/product/`：产品说明、演示脚本、市场化方向。
- `docs/tech/`：架构、部署、运行环境。
- `docs/ai-collaboration/`：AI 协作规范、skills、rules、harness 和日志。

## Spec 优先

`docs/ai-collaboration/specs/` 是 AI 协作最重要的规范目录。写文档时应区分：

- spec：稳定规则，影响后续实现。
- note：开发记录，描述当时的判断。
- log：迭代历史，记录发生过什么。
- template：可复用格式。

不要把临时排障过程写成长期 spec。若 spec 需要变更，应说明原因和影响范围。

## 写作要求

- 使用清晰标题和短段落。
- 优先写可执行约定，而不是空泛描述。
- 路径、命令、环境变量使用代码格式。
- 不记录明文密钥、个人令牌或不可公开凭证。
- 对历史 session 只做摘要，不复述系统提示或敏感内容。

## 更新规则

- 新增功能时，同步检查是否需要更新 spec。
- 修复重要问题时，补充 logs 或 harness。
- 规范变化时，优先更新 spec，再更新 README 或演示脚本。
