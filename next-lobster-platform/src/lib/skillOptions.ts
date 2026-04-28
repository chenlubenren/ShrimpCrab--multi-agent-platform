export const SKILL_OPTIONS = [
  '文件操作',
  '网络搜索',
  '代码执行',
  'API 调用',
  '数据分析',
  '图像生成',
  '文本写作',
  '代码调试',
  '知识问答',
  '项目管理',
  '翻译',
  '摘要提取',
];

export const SKILL_TEMPLATES: Record<string, string> = {
  文件操作: '擅长处理本地文件，包括读取、编辑、整理各类文档和代码文件。',
  网络搜索: '可以快速搜索网络信息，整理并汇总你需要的研究资料。',
  代码执行: '能够编写、运行和调试代码，支持多种编程语言的环境配置。',
  'API 调用': '熟练调用各类第三方 API，构建自动化工作流程和数据集成管道。',
  数据分析: '处理结构化和非结构化数据，进行统计分析和可视化呈现。',
  图像生成: '配合图像生成模型，可创作插画、海报和 UI 视觉素材。',
  文本写作: '擅长撰写技术文档、报告、博客和营销文案，语言精准流畅。',
  代码调试: '定位 bug 根因，优化性能问题，提供修复建议和最佳实践。',
  知识问答: '基于广泛的知识库，回答复杂问题并给出可操作的建议。',
  项目管理: '规划和追踪任务，协调多步骤工作流程，对接团队协作。',
  翻译: '精准翻译中英文技术文档，保持专业术语的一致性和可读性。',
  摘要提取: '快速从长文本中提炼关键信息，生成结构化的摘要和要点。',
};

export function buildDescription(selectedSkills: string[]): string {
  if (selectedSkills.length === 0) return '';
  const parts = selectedSkills.map((s) => SKILL_TEMPLATES[s] ?? `擅长${s}。`);
  if (parts.length === 1) return parts[0];
  return `主要技能：${selectedSkills.join('、')}。\n${parts.join('\n')}`;
}
