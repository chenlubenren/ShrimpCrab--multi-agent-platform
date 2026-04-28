import { ArchitectureAgent, ArchitectureNode, ArchitectureEdge } from '@/types';

/** Standalone agent entries for the card UI (no node/edge data) */
export interface ArchTemplate {
  id: string;
  name: string;
  nameCn: string;
  description: string;
  descriptionCn: string;
  agents: Omit<ArchitectureAgent, 'status' | 'linkedLobster'>[];
  /** Pre-built graph (null = auto-generate linear from agents) */
  nodes?: ArchitectureNode[];
  edges?: ArchitectureEdge[];
}

export const ARCH_TEMPLATES: ArchTemplate[] = [
  // ── 1. 研究团队 ──────────────────────────────────────────────────────────────
  // Linear pipeline: start → 主管 → 文献 → 实验 → 条件判断(通过?) → 写作 → end
  {
    id: 'research-team',
    name: 'Research Team',
    nameCn: '研究团队',
    description: 'Academic research pipeline: direction → literature → experiment → writing',
    descriptionCn: '学术研究流水线：方向规划 → 文献搜索 → 实验分析 → 条件审核 → 论文撰写',
    agents: [
      { id: 'arch-res-director', name: '研究主管', role: '研究方向规划', isManager: true, inputs: ['用户任务'], outputs: ['研究方向'] },
      { id: 'arch-res-lit', name: '文献助手', role: '文献检索与整理', isManager: false, inputs: ['研究方向'], outputs: ['文献综述'] },
      { id: 'arch-res-exp', name: '实验助手', role: '数据分析与实验', isManager: false, inputs: ['文献综述'], outputs: ['实验结论'] },
      { id: 'arch-res-review', name: '质量审核', role: '成果审核', isManager: false, inputs: ['实验结论'], outputs: ['审核结果'] },
      { id: 'arch-res-writer', name: '写作助手', role: '论文撰写', isManager: false, inputs: ['审核结果'], outputs: ['最终报告'] },
    ],
    nodes: [
      { id: 'start-res', type: 'startNode', data: { label: '用户输入' }, position: { x: 50, y: 260 } },
      { id: 'arch-res-director', type: 'agentNode', data: { label: '研究主管', role: '研究方向规划', isManager: true, inputs: ['用户任务'], outputs: ['研究方向'], linkedLobster: null, isDeletable: false, agentId: 'arch-res-director' }, position: { x: 260, y: 240 } },
      { id: 'arch-res-lit', type: 'agentNode', data: { label: '文献助手', role: '文献检索与整理', isManager: false, inputs: ['研究方向'], outputs: ['文献综述'], linkedLobster: null, isDeletable: false, agentId: 'arch-res-lit' }, position: { x: 460, y: 240 } },
      { id: 'arch-res-exp', type: 'agentNode', data: { label: '实验助手', role: '数据分析与实验', isManager: false, inputs: ['文献综述'], outputs: ['实验结论'], linkedLobster: null, isDeletable: false, agentId: 'arch-res-exp' }, position: { x: 660, y: 240 } },
      { id: 'arch-res-review', type: 'conditionNode', data: { label: '质量审核', description: '实验结果达标?' }, position: { x: 860, y: 230 } },
      { id: 'arch-res-writer', type: 'agentNode', data: { label: '写作助手', role: '论文撰写', isManager: false, inputs: ['审核结果'], outputs: ['最终报告'], linkedLobster: null, isDeletable: false, agentId: 'arch-res-writer' }, position: { x: 1080, y: 240 } },
      { id: 'end-res', type: 'endNode', data: { label: '最终报告' }, position: { x: 1280, y: 260 } },
    ],
    edges: [
      { id: 'e-start-res', source: 'start-res', target: 'arch-res-director' },
      { id: 'e-res-dir-lit', source: 'arch-res-director', target: 'arch-res-lit' },
      { id: 'e-res-lit-exp', source: 'arch-res-lit', target: 'arch-res-exp' },
      { id: 'e-res-exp-review', source: 'arch-res-exp', target: 'arch-res-review' },
      { id: 'e-res-review-writer', source: 'arch-res-review', target: 'arch-res-writer', label: '是' },
      { id: 'e-res-review-back', source: 'arch-res-review', target: 'arch-res-exp', label: '否' },
      { id: 'e-res-writer-end', source: 'arch-res-writer', target: 'end-res' },
    ],
  },

  // ── 2. 创意工作室 ───────────────────────────────────────────────────────────
  // Fork-join: start → 总监 → (素材 || 设计) → 审核 → end
  {
    id: 'creative-studio',
    name: 'Creative Studio',
    nameCn: '创意工作室',
    description: 'Creative content pipeline: direction → collection → design → review',
    descriptionCn: '创意内容流水线：方向制定 → 素材收集 + 视觉设计 → 审核发布',
    agents: [
      { id: 'arch-cre-dir', name: '创意总监', role: '创意方向把控', isManager: true, inputs: ['用户需求'], outputs: ['创意方向'] },
      { id: 'arch-cre-col', name: '素材收集员', role: '灵感素材采集', isManager: false, inputs: ['创意方向'], outputs: ['素材库'] },
      { id: 'arch-cre-des', name: '设计师', role: '视觉设计', isManager: false, inputs: ['创意方向'], outputs: ['设计方案'] },
      { id: 'arch-cre-rev', name: '审核员', role: '质量审核', isManager: false, inputs: ['设计方案', '素材库'], outputs: ['终稿'] },
    ],
    nodes: [
      { id: 'start-cre', type: 'startNode', data: { label: '用户需求' }, position: { x: 50, y: 260 } },
      { id: 'arch-cre-dir', type: 'agentNode', data: { label: '创意总监', role: '创意方向把控', isManager: true, inputs: ['用户需求'], outputs: ['创意方向'], linkedLobster: null, isDeletable: false, agentId: 'arch-cre-dir' }, position: { x: 260, y: 240 } },
      { id: 'arch-cre-col', type: 'agentNode', data: { label: '素材收集员', role: '灵感素材采集', isManager: false, inputs: ['创意方向'], outputs: ['素材库'], linkedLobster: null, isDeletable: false, agentId: 'arch-cre-col' }, position: { x: 520, y: 100 } },
      { id: 'arch-cre-des', type: 'agentNode', data: { label: '设计师', role: '视觉设计', isManager: false, inputs: ['创意方向'], outputs: ['设计方案'], linkedLobster: null, isDeletable: false, agentId: 'arch-cre-des' }, position: { x: 520, y: 380 } },
      { id: 'arch-cre-rev', type: 'agentNode', data: { label: '审核员', role: '质量审核', isManager: false, inputs: ['设计方案', '素材库'], outputs: ['终稿'], linkedLobster: null, isDeletable: false, agentId: 'arch-cre-rev' }, position: { x: 780, y: 240 } },
      { id: 'end-cre', type: 'endNode', data: { label: '终稿发布' }, position: { x: 1000, y: 260 } },
    ],
    edges: [
      { id: 'e-start-cre', source: 'start-cre', target: 'arch-cre-dir' },
      { id: 'e-cre-dir-col', source: 'arch-cre-dir', target: 'arch-cre-col' },
      { id: 'e-cre-dir-des', source: 'arch-cre-dir', target: 'arch-cre-des' },
      { id: 'e-cre-col-rev', source: 'arch-cre-col', target: 'arch-cre-rev' },
      { id: 'e-cre-des-rev', source: 'arch-cre-des', target: 'arch-cre-rev' },
      { id: 'e-cre-rev-end', source: 'arch-cre-rev', target: 'end-cre' },
    ],
  },

  // ── 3. 代码工厂 ─────────────────────────────────────────────────────────────
  // Diamond: start → 架构师 → (前端 || 后端) → 测试 → end
  {
    id: 'code-factory',
    name: 'Code Factory',
    nameCn: '代码工厂',
    description: 'Software development pipeline: design → frontend → backend → QA',
    descriptionCn: '软件开发流水线：架构设计 → 前端开发 + 后端开发 → 测试验证 → 部署上线',
    agents: [
      { id: 'arch-code-arch', name: '架构师', role: '系统架构设计', isManager: true, inputs: ['需求规格'], outputs: ['架构文档'] },
      { id: 'arch-code-fe', name: '前端工程师', role: '前端界面开发', isManager: false, inputs: ['架构文档'], outputs: ['前端代码'] },
      { id: 'arch-code-be', name: '后端工程师', role: '后端服务开发', isManager: false, inputs: ['架构文档'], outputs: ['后端代码'] },
      { id: 'arch-code-qa', name: '测试工程师', role: '质量保证', isManager: false, inputs: ['前端代码', '后端代码'], outputs: ['测试报告'] },
      { id: 'arch-code-deploy', name: '部署运维', role: '发布与监控', isManager: false, inputs: ['测试报告'], outputs: ['上线版本'] },
    ],
    nodes: [
      { id: 'start-code', type: 'startNode', data: { label: '需求规格' }, position: { x: 50, y: 260 } },
      { id: 'arch-code-arch', type: 'agentNode', data: { label: '架构师', role: '系统架构设计', isManager: true, inputs: ['需求规格'], outputs: ['架构文档'], linkedLobster: null, isDeletable: false, agentId: 'arch-code-arch' }, position: { x: 260, y: 240 } },
      { id: 'arch-code-fe', type: 'agentNode', data: { label: '前端工程师', role: '前端界面开发', isManager: false, inputs: ['架构文档'], outputs: ['前端代码'], linkedLobster: null, isDeletable: false, agentId: 'arch-code-fe' }, position: { x: 520, y: 100 } },
      { id: 'arch-code-be', type: 'agentNode', data: { label: '后端工程师', role: '后端服务开发', isManager: false, inputs: ['架构文档'], outputs: ['后端代码'], linkedLobster: null, isDeletable: false, agentId: 'arch-code-be' }, position: { x: 520, y: 380 } },
      { id: 'arch-code-qa', type: 'agentNode', data: { label: '测试工程师', role: '质量保证', isManager: false, inputs: ['前端代码', '后端代码'], outputs: ['测试报告'], linkedLobster: null, isDeletable: false, agentId: 'arch-code-qa' }, position: { x: 780, y: 240 } },
      { id: 'arch-code-deploy', type: 'agentNode', data: { label: '部署运维', role: '发布与监控', isManager: false, inputs: ['测试报告'], outputs: ['上线版本'], linkedLobster: null, isDeletable: false, agentId: 'arch-code-deploy' }, position: { x: 1000, y: 240 } },
      { id: 'end-code', type: 'endNode', data: { label: '上线版本' }, position: { x: 1220, y: 260 } },
    ],
    edges: [
      { id: 'e-start-code', source: 'start-code', target: 'arch-code-arch' },
      { id: 'e-code-arch-fe', source: 'arch-code-arch', target: 'arch-code-fe' },
      { id: 'e-code-arch-be', source: 'arch-code-arch', target: 'arch-code-be' },
      { id: 'e-code-fe-qa', source: 'arch-code-fe', target: 'arch-code-qa' },
      { id: 'e-code-be-qa', source: 'arch-code-be', target: 'arch-code-qa' },
      { id: 'e-code-qa-deploy', source: 'arch-code-qa', target: 'arch-code-deploy' },
      { id: 'e-code-deploy-end', source: 'arch-code-deploy', target: 'end-code' },
    ],
  },

  // ── 4. 内容创作工厂 ─────────────────────────────────────────────────────────
  // Parallel: start → 策划 → (文案 || 配图) → 发布 → end
  {
    id: 'content-factory',
    name: 'Content Factory',
    nameCn: '内容创作工厂',
    description: 'Content creation pipeline: plan → write → design → publish',
    descriptionCn: '内容创作流水线：选题策划 → 文案撰写 + 配图设计 → 多平台发布',
    agents: [
      { id: 'arch-con-plan', name: '策划编辑', role: '选题与策划', isManager: true, inputs: ['热点信息'], outputs: ['选题方案'] },
      { id: 'arch-con-writer', name: '文案撰写', role: '文章与脚本', isManager: false, inputs: ['选题方案'], outputs: ['内容文案'] },
      { id: 'arch-con-img', name: '配图设计', role: '视觉素材制作', isManager: false, inputs: ['选题方案'], outputs: ['设计素材'] },
      { id: 'arch-con-pub', name: '运营发布', role: '多平台发布', isManager: false, inputs: ['内容文案', '设计素材'], outputs: ['发布结果'] },
    ],
    nodes: [
      { id: 'start-con', type: 'startNode', data: { label: '热点信息' }, position: { x: 50, y: 260 } },
      { id: 'arch-con-plan', type: 'agentNode', data: { label: '策划编辑', role: '选题与策划', isManager: true, inputs: ['热点信息'], outputs: ['选题方案'], linkedLobster: null, isDeletable: false, agentId: 'arch-con-plan' }, position: { x: 260, y: 240 } },
      { id: 'arch-con-writer', type: 'agentNode', data: { label: '文案撰写', role: '文章与脚本', isManager: false, inputs: ['选题方案'], outputs: ['内容文案'], linkedLobster: null, isDeletable: false, agentId: 'arch-con-writer' }, position: { x: 520, y: 100 } },
      { id: 'arch-con-img', type: 'agentNode', data: { label: '配图设计', role: '视觉素材制作', isManager: false, inputs: ['选题方案'], outputs: ['设计素材'], linkedLobster: null, isDeletable: false, agentId: 'arch-con-img' }, position: { x: 520, y: 380 } },
      { id: 'arch-con-pub', type: 'agentNode', data: { label: '运营发布', role: '多平台发布', isManager: false, inputs: ['内容文案', '设计素材'], outputs: ['发布结果'], linkedLobster: null, isDeletable: false, agentId: 'arch-con-pub' }, position: { x: 780, y: 240 } },
      { id: 'end-con', type: 'endNode', data: { label: '发布完成' }, position: { x: 1000, y: 260 } },
    ],
    edges: [
      { id: 'e-start-con', source: 'start-con', target: 'arch-con-plan' },
      { id: 'e-con-plan-writer', source: 'arch-con-plan', target: 'arch-con-writer' },
      { id: 'e-con-plan-img', source: 'arch-con-plan', target: 'arch-con-img' },
      { id: 'e-con-writer-pub', source: 'arch-con-writer', target: 'arch-con-pub' },
      { id: 'e-con-img-pub', source: 'arch-con-img', target: 'arch-con-pub' },
      { id: 'e-con-pub-end', source: 'arch-con-pub', target: 'end-con' },
    ],
  },

  // ── 5. 三省六部制 ───────────────────────────────────────────────────────────
  // Historical Chinese governance: start → 中书起草 → 门下审议 → 尚书执行 → 六部分头
  {
    id: '三省六部',
    name: 'San Sheng Liu Bu',
    nameCn: '三省六部制',
    description: 'Traditional Chinese governance: Zhongshu → Menshan + Zhongshu → Six Boards',
    descriptionCn: '中国传统官制：中书起草 → 门下审议 → 尚书执行 → 六部分头办理',
    agents: [
      { id: 'arch-三省-中书', name: '中书省', role: '诏令起草', isManager: false, inputs: ['皇帝旨意'], outputs: ['诏令草案'] },
      { id: 'arch-三省-门下', name: '门下省', role: '审核签署', isManager: false, inputs: ['诏令草案'], outputs: ['正式诏令'] },
      { id: 'arch-三省-尚书', name: '尚书省', role: '政令执行', isManager: false, inputs: ['正式诏令'], outputs: ['执行指令'] },
      { id: 'arch-三省-吏部', name: '吏部', role: '官员任免', isManager: false, inputs: ['执行指令'], outputs: ['人事决定'] },
      { id: 'arch-三省-户部', name: '户部', role: '财政税务', isManager: false, inputs: ['执行指令'], outputs: ['财政计划'] },
      { id: 'arch-三省-礼部', name: '礼部', role: '礼仪外交', isManager: false, inputs: ['执行指令'], outputs: ['礼宾方案'] },
      { id: 'arch-三省-兵部', name: '兵部', role: '军政武备', isManager: false, inputs: ['执行指令'], outputs: ['军令'] },
      { id: 'arch-三省-刑部', name: '刑部', role: '司法刑狱', isManager: false, inputs: ['执行指令'], outputs: ['判决'] },
      { id: 'arch-三省-工部', name: '工部', role: '营建工程', isManager: false, inputs: ['执行指令'], outputs: ['工程计划'] },
    ],
    nodes: [
      { id: 'start-sz', type: 'startNode', data: { label: '皇帝旨意' }, position: { x: 30, y: 260 } },
      { id: 'arch-三省-中书', type: 'agentNode', data: { label: '中书省', role: '诏令起草', isManager: false, inputs: ['皇帝旨意'], outputs: ['诏令草案'], linkedLobster: null, isDeletable: false, agentId: 'arch-三省-中书' }, position: { x: 240, y: 260 } },
      { id: 'arch-三省-门下', type: 'agentNode', data: { label: '门下省', role: '审核签署', isManager: false, inputs: ['诏令草案'], outputs: ['正式诏令'], linkedLobster: null, isDeletable: false, agentId: 'arch-三省-门下' }, position: { x: 450, y: 260 } },
      { id: 'arch-三省-尚书', type: 'agentNode', data: { label: '尚书省', role: '政令执行', isManager: false, inputs: ['正式诏令'], outputs: ['执行指令'], linkedLobster: null, isDeletable: false, agentId: 'arch-三省-尚书' }, position: { x: 660, y: 260 } },
      { id: 'arch-三省-吏部', type: 'agentNode', data: { label: '吏部', role: '官员任免', isManager: false, inputs: ['执行指令'], outputs: ['人事决定'], linkedLobster: null, isDeletable: false, agentId: 'arch-三省-吏部' }, position: { x: 960, y: 60 } },
      { id: 'arch-三省-户部', type: 'agentNode', data: { label: '户部', role: '财政税务', isManager: false, inputs: ['执行指令'], outputs: ['财政计划'], linkedLobster: null, isDeletable: false, agentId: 'arch-三省-户部' }, position: { x: 960, y: 160 } },
      { id: 'arch-三省-礼部', type: 'agentNode', data: { label: '礼部', role: '礼仪外交', isManager: false, inputs: ['执行指令'], outputs: ['礼宾方案'], linkedLobster: null, isDeletable: false, agentId: 'arch-三省-礼部' }, position: { x: 960, y: 260 } },
      { id: 'arch-三省-兵部', type: 'agentNode', data: { label: '兵部', role: '军政武备', isManager: false, inputs: ['执行指令'], outputs: ['军令'], linkedLobster: null, isDeletable: false, agentId: 'arch-三省-兵部' }, position: { x: 960, y: 360 } },
      { id: 'arch-三省-刑部', type: 'agentNode', data: { label: '刑部', role: '司法刑狱', isManager: false, inputs: ['执行指令'], outputs: ['判决'], linkedLobster: null, isDeletable: false, agentId: 'arch-三省-刑部' }, position: { x: 960, y: 460 } },
      { id: 'arch-三省-工部', type: 'agentNode', data: { label: '工部', role: '营建工程', isManager: false, inputs: ['执行指令'], outputs: ['工程计划'], linkedLobster: null, isDeletable: false, agentId: 'arch-三省-工部' }, position: { x: 960, y: 560 } },
    ],
    edges: [
      { id: 'e-sz-start', source: 'start-sz', target: 'arch-三省-中书' },
      { id: 'e-sz-zs-mx', source: 'arch-三省-中书', target: 'arch-三省-门下' },
      { id: 'e-sz-mx-ss', source: 'arch-三省-门下', target: 'arch-三省-尚书' },
      { id: 'e-sz-ss-libu', source: 'arch-三省-尚书', target: 'arch-三省-吏部' },
      { id: 'e-sz-ss-hubu', source: 'arch-三省-尚书', target: 'arch-三省-户部' },
      { id: 'e-sz-ss-lib', source: 'arch-三省-尚书', target: 'arch-三省-礼部' },
      { id: 'e-sz-ss-bing', source: 'arch-三省-尚书', target: 'arch-三省-兵部' },
      { id: 'e-sz-ss-xing', source: 'arch-三省-尚书', target: 'arch-三省-刑部' },
      { id: 'e-sz-ss-gong', source: 'arch-三省-尚书', target: 'arch-三省-工部' },
    ],
  },

  // ── 6. 软件开发生命周期 (SDLC) ──────────────────────────────────────────────
  // Loop-back pipeline: start → 需求 → 条件(可行?) → 设计 → 开发 → 测试 → 部署 → end
  {
    id: 'sdlc-pipeline',
    name: 'SDLC Pipeline',
    nameCn: '软件开发生命周期',
    description: 'Full software development lifecycle from planning to deployment',
    descriptionCn: '完整软件开发生命周期：需求 → 可行性判断 → 设计开发测试 → 部署上线',
    agents: [
      { id: 'arch-sd-req', name: '需求分析', role: '需求收集与分析', isManager: false, inputs: ['用户反馈'], outputs: ['需求文档'] },
      { id: 'arch-sd-check', name: '可行性审查', role: '技术可行性评估', isManager: false, inputs: ['需求文档'], outputs: ['审查结论'] },
      { id: 'arch-sd-design', name: '系统设计', role: '架构与详细设计', isManager: false, inputs: ['审查结论'], outputs: ['设计文档'] },
      { id: 'arch-sd-dev', name: '编码开发', role: '代码编写', isManager: false, inputs: ['设计文档'], outputs: ['源代码'] },
      { id: 'arch-sd-test', name: '测试验证', role: '单元与集成测试', isManager: false, inputs: ['源代码'], outputs: ['测试报告'] },
      { id: 'arch-sd-deploy', name: '部署运维', role: '发布与监控', isManager: false, inputs: ['测试报告'], outputs: ['上线版本'] },
    ],
    nodes: [
      { id: 'start-sd', type: 'startNode', data: { label: '用户反馈' }, position: { x: 50, y: 260 } },
      { id: 'arch-sd-req', type: 'agentNode', data: { label: '需求分析', role: '需求收集与分析', isManager: false, inputs: ['用户反馈'], outputs: ['需求文档'], linkedLobster: null, isDeletable: false, agentId: 'arch-sd-req' }, position: { x: 260, y: 240 } },
      { id: 'arch-sd-check', type: 'conditionNode', data: { label: '可行性审查', description: '技术上可行?' }, position: { x: 460, y: 230 } },
      { id: 'arch-sd-design', type: 'agentNode', data: { label: '系统设计', role: '架构与详细设计', isManager: false, inputs: ['审查结论'], outputs: ['设计文档'], linkedLobster: null, isDeletable: false, agentId: 'arch-sd-design' }, position: { x: 700, y: 120 } },
      { id: 'arch-sd-dev', type: 'agentNode', data: { label: '编码开发', role: '代码编写', isManager: false, inputs: ['设计文档'], outputs: ['源代码'], linkedLobster: null, isDeletable: false, agentId: 'arch-sd-dev' }, position: { x: 700, y: 360 } },
      { id: 'arch-sd-test', type: 'agentNode', data: { label: '测试验证', role: '单元与集成测试', isManager: false, inputs: ['源代码'], outputs: ['测试报告'], linkedLobster: null, isDeletable: false, agentId: 'arch-sd-test' }, position: { x: 940, y: 240 } },
      { id: 'arch-sd-deploy', type: 'agentNode', data: { label: '部署运维', role: '发布与监控', isManager: false, inputs: ['测试报告'], outputs: ['上线版本'], linkedLobster: null, isDeletable: false, agentId: 'arch-sd-deploy' }, position: { x: 1160, y: 240 } },
      { id: 'end-sd', type: 'endNode', data: { label: '上线版本' }, position: { x: 1360, y: 260 } },
    ],
    edges: [
      { id: 'e-sd-start', source: 'start-sd', target: 'arch-sd-req' },
      { id: 'e-sd-req-check', source: 'arch-sd-req', target: 'arch-sd-check' },
      { id: 'e-sd-check-design', source: 'arch-sd-check', target: 'arch-sd-design', label: '可行' },
      { id: 'e-sd-design-dev', source: 'arch-sd-design', target: 'arch-sd-dev' },
      { id: 'e-sd-dev-test', source: 'arch-sd-dev', target: 'arch-sd-test' },
      { id: 'e-sd-test-deploy', source: 'arch-sd-test', target: 'arch-sd-deploy' },
      { id: 'e-sd-deploy-end', source: 'arch-sd-deploy', target: 'end-sd' },
      { id: 'e-sd-check-req', source: 'arch-sd-check', target: 'arch-sd-req', label: '驳回' },
    ],
  },

  // ── 7. 政府行政流程 (Modern Gov) ────────────────────────────────────────────
  // Modern administrative: start → 受理 → 初审 → 会审 → 审批 → 执行 → end
  {
    id: 'gov-admin',
    name: 'Government Admin',
    nameCn: '政府行政流程',
    description: 'Modern administrative approval workflow with review gates',
    descriptionCn: '现代行政审批流程：受理 → 初审 → 会审 → 审批 → 执行 → 归档',
    agents: [
      { id: 'arch-gov-receive', name: '受理窗口', role: '材料接收与登记', isManager: false, inputs: ['申请材料'], outputs: ['登记记录'] },
      { id: 'arch-gov-first', name: '初审人员', role: '形式审查', isManager: false, inputs: ['登记记录'], outputs: ['初审意见'] },
      { id: 'arch-gov-review', name: '会审部门', role: '实质审查', isManager: false, inputs: ['初审意见'], outputs: ['会审结论'] },
      { id: 'arch-gov-approve', name: '审批领导', role: '最终决定', isManager: true, inputs: ['会审结论'], outputs: ['批准决定'] },
      { id: 'arch-gov-execute', name: '执行部门', role: '决定执行', isManager: false, inputs: ['批准决定'], outputs: ['执行结果'] },
      { id: 'arch-gov-archive', name: '归档人员', role: '档案管理', isManager: false, inputs: ['执行结果'], outputs: ['归档完成'] },
    ],
    nodes: [
      { id: 'start-gov', type: 'startNode', data: { label: '申请材料' }, position: { x: 50, y: 260 } },
      { id: 'arch-gov-receive', type: 'agentNode', data: { label: '受理窗口', role: '材料接收与登记', isManager: false, inputs: ['申请材料'], outputs: ['登记记录'], linkedLobster: null, isDeletable: false, agentId: 'arch-gov-receive' }, position: { x: 260, y: 240 } },
      { id: 'arch-gov-first', type: 'agentNode', data: { label: '初审人员', role: '形式审查', isManager: false, inputs: ['登记记录'], outputs: ['初审意见'], linkedLobster: null, isDeletable: false, agentId: 'arch-gov-first' }, position: { x: 460, y: 240 } },
      { id: 'arch-gov-review', type: 'conditionNode', data: { label: '会审部门', description: '材料齐全合规?' }, position: { x: 660, y: 230 } },
      { id: 'arch-gov-approve', type: 'agentNode', data: { label: '审批领导', role: '最终决定', isManager: true, inputs: ['会审结论'], outputs: ['批准决定'], linkedLobster: null, isDeletable: false, agentId: 'arch-gov-approve' }, position: { x: 900, y: 120 } },
      { id: 'arch-gov-execute', type: 'agentNode', data: { label: '执行部门', role: '决定执行', isManager: false, inputs: ['批准决定'], outputs: ['执行结果'], linkedLobster: null, isDeletable: false, agentId: 'arch-gov-execute' }, position: { x: 1100, y: 240 } },
      { id: 'arch-gov-archive', type: 'agentNode', data: { label: '归档人员', role: '档案管理', isManager: false, inputs: ['执行结果'], outputs: ['归档完成'], linkedLobster: null, isDeletable: false, agentId: 'arch-gov-archive' }, position: { x: 1300, y: 240 } },
      { id: 'end-gov', type: 'endNode', data: { label: '归档完成' }, position: { x: 1500, y: 260 } },
    ],
    edges: [
      { id: 'e-gov-start', source: 'start-gov', target: 'arch-gov-receive' },
      { id: 'e-gov-receive-first', source: 'arch-gov-receive', target: 'arch-gov-first' },
      { id: 'e-gov-first-review', source: 'arch-gov-first', target: 'arch-gov-review' },
      { id: 'e-gov-review-approve', source: 'arch-gov-review', target: 'arch-gov-approve', label: '通过' },
      { id: 'e-gov-review-first', source: 'arch-gov-review', target: 'arch-gov-first', label: '补正' },
      { id: 'e-gov-approve-execute', source: 'arch-gov-approve', target: 'arch-gov-execute' },
      { id: 'e-gov-execute-archive', source: 'arch-gov-execute', target: 'arch-gov-archive' },
      { id: 'e-gov-archive-end', source: 'arch-gov-archive', target: 'end-gov' },
    ],
  },
];

/** Encode template for URL query param */
export function encodeTemplate(template: ArchTemplate): string {
  return btoa(encodeURIComponent(JSON.stringify(template)));
}

/** Decode template from URL query param */
export function decodeTemplate(encoded: string): ArchTemplate | null {
  try {
    return JSON.parse(decodeURIComponent(atob(encoded))) as ArchTemplate;
  } catch {
    return null;
  }
}
