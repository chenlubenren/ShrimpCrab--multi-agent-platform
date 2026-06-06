import { spawn } from 'child_process';
import os from 'os';

export type WorkflowNodeType = 'start' | 'agent' | 'condition' | 'end';
export type WorkflowEdgeBranch = 'yes' | 'no';
export type WorkflowAgentKind =
  | 'worker'
  | 'router'
  | 'aggregator'
  | 'judge'
  | 'orchestrator'
  | 'evaluator'
  | 'optimizer';

export interface AvailableAgentForWorkflow {
  id: string;
  name: string;
  role?: string;
  description?: string;
  tags?: string[];
}

export interface WorkflowDslNode {
  id: string;
  type: WorkflowNodeType;
  label: string;
  position?: { x: number; y: number };
  outputKey?: string;
  agentInstanceId?: string;
  role?: string;
  kind?: WorkflowAgentKind;
  inputTemplate?: string;
  isManager?: boolean;
  expression?: string;
  resultKey?: string;
}

export interface WorkflowDslEdge {
  id: string;
  from: string;
  to: string;
  branch?: WorkflowEdgeBranch;
  label?: string;
}

export interface WorkflowDsl {
  schemaVersion: '1.0';
  name: string;
  description: string;
  entryNodeId: string;
  nodes: WorkflowDslNode[];
  edges: WorkflowDslEdge[];
  execution: {
    mode: 'dag' | 'state-machine';
    maxConcurrency: number;
    timeoutSec: number;
    maxIterations?: number;
  };
  metadata?: {
    source?: 'canvas' | 'natural-language' | 'template' | 'fallback';
    generatedBy?: string;
    collaborationPattern?: string;
    warnings?: Array<{ code: string; message: string }>;
  };
}

type WorkflowGenerator = 'deepseek' | 'pi' | 'fallback';

export interface GenerateWorkflowResult {
  workflowDsl: WorkflowDsl;
  generator: WorkflowGenerator;
  warnings: string[];
}

interface CommandResult {
  stdout: string;
  stderr: string;
}

const PI_TIMEOUT_MS = Number(process.env.PI_WORKFLOW_TIMEOUT_MS || 45000);
const DEEPSEEK_WORKFLOW_TIMEOUT_MS = Number(process.env.DEEPSEEK_WORKFLOW_TIMEOUT_MS || 60000);
const DEEPSEEK_WORKFLOW_BASE_URL = process.env.DEEPSEEK_WORKFLOW_BASE_URL || 'https://api.deepseek.com';
const DEEPSEEK_WORKFLOW_MODEL = process.env.DEEPSEEK_WORKFLOW_MODEL || 'deepseek-v4-pro';

export async function generateWorkflowDslFromPrompt(
  prompt: string,
  availableAgents: AvailableAgentForWorkflow[] = []
): Promise<GenerateWorkflowResult> {
  const warnings: string[] = [];

  if (process.env.DISABLE_DEEPSEEK_WORKFLOW !== '1') {
    try {
      const deepseekOutput = await runDeepSeekWorkflowPrompt(prompt, availableAgents);
      const parsed = extractJsonObject(deepseekOutput);
      const workflowDsl = normalizeWorkflowDsl(parsed, prompt, availableAgents, 'deepseek');
      return {
        workflowDsl,
        generator: 'deepseek',
        warnings,
      };
    } catch (error) {
      warnings.push(`DeepSeek workflow generation failed, falling back to Pi Agent: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    warnings.push('DISABLE_DEEPSEEK_WORKFLOW=1, skipped DeepSeek workflow generation.');
  }

  if (process.env.DISABLE_PI_WORKFLOW !== '1') {
    try {
      const piOutput = await runPiWorkflowPrompt(prompt, availableAgents);
      const parsed = extractJsonObject(piOutput.stdout);
      const workflowDsl = normalizeWorkflowDsl(parsed, prompt, availableAgents, 'pi');
      return {
        workflowDsl,
        generator: 'pi',
        warnings,
      };
    } catch (error) {
      warnings.push(`Pi Agent 生成失败，已使用稳定 fallback：${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    warnings.push('DISABLE_PI_WORKFLOW=1，已跳过 Pi Agent。');
  }

  return {
    workflowDsl: buildFallbackWorkflowDsl(prompt, availableAgents, warnings),
    generator: 'fallback',
    warnings,
  };
}

async function runDeepSeekWorkflowPrompt(
  prompt: string,
  availableAgents: AvailableAgentForWorkflow[]
): Promise<string> {
  const apiKey = getDeepSeekApiKey();
  if (!apiKey) {
    throw new Error('missing DEEPSEEK_API_KEY');
  }

  const { systemPrompt, userPrompt } = buildWorkflowPromptParts(prompt, availableAgents);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEEPSEEK_WORKFLOW_TIMEOUT_MS);

  try {
    const response = await fetch(buildChatCompletionsUrl(DEEPSEEK_WORKFLOW_BASE_URL), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEEPSEEK_WORKFLOW_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        thinking: { type: 'disabled' },
        stream: false,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${truncateForLog(raw)}`);
    }

    return extractOpenAiCompatibleMessageContent(raw);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`timeout after ${DEEPSEEK_WORKFLOW_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function runPiWorkflowPrompt(
  prompt: string,
  availableAgents: AvailableAgentForWorkflow[]
): Promise<CommandResult> {
  const { systemPrompt, userPrompt } = buildWorkflowPromptParts(prompt, availableAgents);
  const piPrompt = [
    systemPrompt,
    '',
    userPrompt,
  ].join('\n');

  const args = [
    '--no-tools',
    '--no-skills',
    '--no-context-files',
    '--no-extensions',
    '--no-session',
    '--mode',
    'text',
  ];

  if (process.env.PI_WORKFLOW_PROVIDER) {
    args.push('--provider', process.env.PI_WORKFLOW_PROVIDER);
  }
  if (process.env.PI_WORKFLOW_MODEL) {
    args.push('--model', process.env.PI_WORKFLOW_MODEL);
  }

  args.push('--thinking', process.env.PI_WORKFLOW_THINKING || 'off');
  args.push('--print', piPrompt);

  if (os.platform() === 'win32') {
    return runCommand('cmd.exe', ['/c', 'pi', ...args], PI_TIMEOUT_MS);
  }

  return runCommand('pi', args, PI_TIMEOUT_MS);
}

function buildWorkflowPromptParts(
  prompt: string,
  availableAgents: AvailableAgentForWorkflow[]
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = [
    'You convert natural language multi-agent workflow requirements into strict JSON Workflow DSL.',
    'Return JSON only. Do not include markdown fences.',
    'Use schemaVersion "1.0".',
    'Allowed node types: start, agent, condition, end.',
    'Agent nodes may set kind to one of: worker, router, aggregator, judge, orchestrator, evaluator, optimizer.',
    'Use orchestrator/manager nodes only when the user asks for central coordination or task decomposition.',
    'Prefer direct prompt-chain, routing, parallelization, competition/judge, or evaluator-optimizer graphs when they fit the request.',
    'Set metadata.collaborationPattern when clear: prompt-chain, routing, parallelization, competition, orchestrator-workers, evaluator-optimizer, or custom.',
    'Agent nodes may set agentInstanceId only when it exactly matches an available agent id.',
    'Condition outgoing edges must use branch "yes" or "no".',
    'Always include one start node and at least one end node.',
    'Use stable ASCII ids like node-start, agent-researcher, condition-review, node-end.',
    'Output shape: {"workflowDsl":{...}}',
  ].join('\n');

  const userPrompt = [
    'Available agents:',
    JSON.stringify(availableAgents, null, 2),
    '',
    'User requirement:',
    prompt,
  ].join('\n');

  return { systemPrompt, userPrompt };
}

function getDeepSeekApiKey(): string | undefined {
  return process.env.DEEPSEEK_API_KEY;
}

function buildChatCompletionsUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, '');
  if (normalized.endsWith('/chat/completions')) {
    return normalized;
  }
  return `${normalized}/chat/completions`;
}

function extractOpenAiCompatibleMessageContent(raw: string): string {
  const payload = JSON.parse(raw) as unknown;
  if (!isRecord(payload)) {
    throw new Error('DeepSeek response is not an object');
  }

  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const firstChoice = choices.find(isRecord);
  const message = firstChoice && isRecord(firstChoice.message) ? firstChoice.message : undefined;
  const content = message?.content;

  if (typeof content === 'string' && content.trim()) {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (isRecord(part) && typeof part.text === 'string') return part.text;
        if (isRecord(part) && typeof part.content === 'string') return part.content;
        return '';
      })
      .join('')
      .trim();
    if (text) return text;
  }

  throw new Error('DeepSeek response has no message content');
}

function truncateForLog(value: string): string {
  return value.length > 300 ? `${value.slice(0, 300)}...` : value;
}

function runCommand(command: string, args: string[], timeoutMs: number): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env },
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`pi timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && stdout.trim()) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr.trim() || `pi exited with code ${code}`));
    });
  });
}

function extractJsonObject(output: string): unknown {
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Pi Agent 未返回 JSON');
  }
  return JSON.parse(output.slice(start, end + 1));
}

function normalizeWorkflowDsl(
  raw: unknown,
  prompt: string,
  availableAgents: AvailableAgentForWorkflow[],
  generator: WorkflowGenerator
): WorkflowDsl {
  const obj = isRecord(raw) && isRecord(raw.workflowDsl) ? raw.workflowDsl : raw;
  if (!isRecord(obj)) {
    throw new Error('Workflow DSL 不是对象');
  }

  const rawNodes = Array.isArray(obj.nodes) ? obj.nodes.filter(isRecord) : [];
  if (rawNodes.length === 0) {
    throw new Error('Workflow DSL 没有 nodes');
  }

  const agentIds = new Set(availableAgents.map((agent) => agent.id));
  const idMap = new Map<string, string>();
  const usedIds = new Set<string>();

  const normalizedNodes = rawNodes.map((node, index) => {
    const type = normalizeNodeType(node.type);
    const fallbackPrefix = type === 'start' ? 'node-start' : type === 'end' ? 'node-end' : `${type}-${index + 1}`;
    const rawId = typeof node.id === 'string' && node.id.trim() ? node.id.trim() : fallbackPrefix;
    const id = uniqueId(sanitizeId(rawId, fallbackPrefix), usedIds);
    idMap.set(rawId, id);

    const label = typeof node.label === 'string' && node.label.trim()
      ? node.label.trim()
      : defaultNodeLabel(type, index);
    const position = isRecord(node.position) &&
      typeof node.position.x === 'number' &&
      typeof node.position.y === 'number'
      ? { x: node.position.x, y: node.position.y }
      : undefined;

    if (type === 'start') {
      return {
        id,
        type,
        label,
        outputKey: typeof node.outputKey === 'string' ? node.outputKey : 'user_task',
        position,
      } satisfies WorkflowDslNode;
    }

    if (type === 'condition') {
      return {
        id,
        type,
        label,
        expression: typeof node.expression === 'string' && node.expression.trim()
          ? node.expression.trim()
          : label,
        position,
      } satisfies WorkflowDslNode;
    }

    if (type === 'end') {
      return {
        id,
        type,
        label,
        resultKey: typeof node.resultKey === 'string' ? node.resultKey : 'final_output',
        position,
      } satisfies WorkflowDslNode;
    }

    const requestedAgentId = typeof node.agentInstanceId === 'string' ? node.agentInstanceId : undefined;
    return {
      id,
      type,
      label,
      agentInstanceId: requestedAgentId && agentIds.has(requestedAgentId) ? requestedAgentId : undefined,
      role: typeof node.role === 'string' && node.role.trim() ? node.role.trim() : label,
      kind: normalizeAgentKind(node.kind, Boolean(node.isManager)),
      inputTemplate: typeof node.inputTemplate === 'string' ? node.inputTemplate : '{{upstream_outputs}}',
      outputKey: typeof node.outputKey === 'string' && node.outputKey.trim() ? node.outputKey.trim() : `${id}_output`,
      isManager: Boolean(node.isManager),
      position,
    } satisfies WorkflowDslNode;
  });

  const nodes = ensureBoundaryNodes(normalizedNodes);
  const start = nodes.find((node) => node.type === 'start')!;
  const rawEdges = Array.isArray(obj.edges) ? obj.edges.filter(isRecord) : [];
  const edges = normalizeEdges(rawEdges, nodes, idMap);
  const finalEdges = repairWorkflowEdges(nodes, edges.length > 0 ? edges : buildLinearEdges(nodes));
  const hasCycle = detectCycle(nodes, finalEdges);
  const collaborationPattern = getMetadataString(obj.metadata, 'collaborationPattern') ??
    inferCollaborationPattern(nodes, finalEdges, hasCycle);

  return {
    schemaVersion: '1.0',
    name: typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : inferWorkflowName(prompt),
    description: typeof obj.description === 'string' ? obj.description : prompt,
    entryNodeId: start.id,
    nodes,
    edges: finalEdges,
    execution: {
      mode: hasCycle ? 'state-machine' : 'dag',
      maxConcurrency: 2,
      timeoutSec: 1800,
      maxIterations: hasCycle ? 3 : undefined,
    },
    metadata: {
      source: generator === 'fallback' ? 'fallback' : 'natural-language',
      generatedBy: generator === 'deepseek'
        ? 'deepseek'
        : generator === 'pi'
          ? 'pi-agent'
          : 'fallback-parser',
      collaborationPattern,
    },
  };
}

function normalizeEdges(
  rawEdges: Record<string, unknown>[],
  nodes: WorkflowDslNode[],
  idMap: Map<string, string>
): WorkflowDslEdge[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const sourceTypes = new Map(nodes.map((node) => [node.id, node.type]));
  const normalized: WorkflowDslEdge[] = [];

  rawEdges.forEach((edge, index) => {
    const rawFrom = typeof edge.from === 'string' ? edge.from : typeof edge.source === 'string' ? edge.source : '';
    const rawTo = typeof edge.to === 'string' ? edge.to : typeof edge.target === 'string' ? edge.target : '';
    const from = idMap.get(rawFrom) ?? sanitizeId(rawFrom, rawFrom);
    const to = idMap.get(rawTo) ?? sanitizeId(rawTo, rawTo);
    if (!nodeIds.has(from) || !nodeIds.has(to) || from === to) return;
    const branch = normalizeBranch(edge.branch, edge.label);
    normalized.push({
      id: typeof edge.id === 'string' && edge.id.trim() ? sanitizeId(edge.id, `edge-${index + 1}`) : `edge-${from}-${to}`,
      from,
      to,
      branch: sourceTypes.get(from) === 'condition' ? branch : undefined,
      label: typeof edge.label === 'string' ? edge.label : undefined,
    });
  });

  return normalized;
}

function ensureBoundaryNodes(nodes: WorkflowDslNode[]): WorkflowDslNode[] {
  const start = nodes.find((node) => node.type === 'start') ??
    { id: 'node-start', type: 'start' as const, label: '用户输入', outputKey: 'user_task' };
  const end = nodes.find((node) => node.type === 'end') ??
    { id: 'node-end', type: 'end' as const, label: '最终输出', resultKey: 'final_output' };
  const middle = nodes.filter((node) => node.type !== 'start' && node.type !== 'end');
  return [start, ...middle, end];
}

function repairWorkflowEdges(nodes: WorkflowDslNode[], edges: WorkflowDslEdge[]): WorkflowDslEdge[] {
  const start = nodes.find((node) => node.type === 'start')!;
  const end = nodes.find((node) => node.type === 'end')!;
  const nodeIds = new Set(nodes.map((node) => node.id));
  const validEdges = edges.filter((edge) =>
    nodeIds.has(edge.from) &&
    nodeIds.has(edge.to) &&
    edge.from !== edge.to &&
    nodes.find((node) => node.id === edge.from)?.type !== 'end' &&
    nodes.find((node) => node.id === edge.to)?.type !== 'start'
  );

  const nextEdges = [...validEdges];

  for (const node of nodes) {
    if (node.type === 'start' || node.type === 'end') continue;
    const hasIncoming = nextEdges.some((edge) => edge.to === node.id);
    if (!hasIncoming) {
      nextEdges.push({
        id: `edge-${start.id}-${node.id}`,
        from: start.id,
        to: node.id,
      });
    }
  }

  for (const node of nodes) {
    if (node.type === 'end') continue;
    const outgoing = nextEdges.filter((edge) => edge.from === node.id);
    if (node.type === 'condition') {
      const yes = outgoing.find((edge) => edge.branch === 'yes');
      const no = outgoing.find((edge) => edge.branch === 'no');

      if (outgoing.length >= 2 && !yes && !no) {
        outgoing[0].branch = 'yes';
        outgoing[1].branch = 'no';
      } else if (outgoing.length === 1 && !outgoing[0].branch) {
        outgoing[0].branch = 'yes';
      }

      if (!nextEdges.some((edge) => edge.from === node.id && edge.branch === 'yes')) {
        nextEdges.push({
          id: `edge-${node.id}-yes-${end.id}`,
          from: node.id,
          to: end.id,
          branch: 'yes',
          label: 'yes',
        });
      }
      if (!nextEdges.some((edge) => edge.from === node.id && edge.branch === 'no')) {
        nextEdges.push({
          id: `edge-${node.id}-no-${end.id}`,
          from: node.id,
          to: end.id,
          branch: 'no',
          label: 'no',
        });
      }
      continue;
    }

    if (outgoing.length === 0) {
      nextEdges.push({
        id: `edge-${node.id}-${end.id}`,
        from: node.id,
        to: end.id,
      });
    }
  }

  const seen = new Set<string>();
  return nextEdges.filter((edge) => {
    const key = `${edge.from}:${edge.branch ?? ''}:${edge.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildFallbackWorkflowDsl(
  prompt: string,
  availableAgents: AvailableAgentForWorkflow[],
  warnings: string[]
): WorkflowDsl {
  const matchedAgents = matchAvailableAgents(prompt, availableAgents);
  const agentSpecs = matchedAgents.length > 0
    ? matchedAgents.map((agent, index) => ({
        id: `agent-${index + 1}`,
        label: agent.name,
        role: agent.role || agent.description || '任务执行',
        agentInstanceId: agent.id,
        kind: index === matchedAgents.length - 1 ? 'aggregator' as const : 'worker' as const,
        isManager: false,
      }))
    : inferFallbackAgentSpecs(prompt);

  const nodes: WorkflowDslNode[] = [
    { id: 'node-start', type: 'start', label: '用户输入', outputKey: 'user_task', position: { x: 80, y: 240 } },
    ...agentSpecs.map((agent, index) => ({
      id: sanitizeId(agent.id, `agent-${index + 1}`),
      type: 'agent' as const,
      label: agent.label,
      role: agent.role,
      agentInstanceId: agent.agentInstanceId,
      inputTemplate: index === 0 ? '{{user_task}}' : '{{upstream_outputs}}',
      outputKey: `${sanitizeId(agent.id, `agent-${index + 1}`)}_output`,
      kind: agent.kind ?? (agent.isManager ? 'orchestrator' : 'worker'),
      isManager: agent.isManager,
      position: { x: 340 + index * 260, y: 240 },
    })),
    { id: 'node-end', type: 'end', label: '最终输出', resultKey: 'final_output', position: { x: 340 + agentSpecs.length * 260, y: 240 } },
  ];

  const edges = buildLinearEdges(nodes);
  warnings.push('fallback 只生成稳定线性流程；复杂条件分支可在画布中继续编辑。');

  return {
    schemaVersion: '1.0',
    name: inferWorkflowName(prompt),
    description: prompt,
    entryNodeId: 'node-start',
    nodes,
    edges,
    execution: {
      mode: 'dag',
      maxConcurrency: 2,
      timeoutSec: 1800,
    },
    metadata: {
      source: 'fallback',
      generatedBy: 'fallback-parser',
      collaborationPattern: inferCollaborationPattern(nodes, edges, false),
    },
  };
}

function buildLinearEdges(nodes: WorkflowDslNode[]): WorkflowDslEdge[] {
  return nodes.slice(0, -1).map((node, index) => ({
    id: `edge-${node.id}-${nodes[index + 1].id}`,
    from: node.id,
    to: nodes[index + 1].id,
  }));
}

function matchAvailableAgents(prompt: string, availableAgents: AvailableAgentForWorkflow[]): AvailableAgentForWorkflow[] {
  const normalizedPrompt = prompt.toLowerCase();
  return availableAgents
    .filter((agent) => {
      const terms = [agent.name, agent.role, agent.description, ...(agent.tags ?? [])]
        .filter((term): term is string => Boolean(term && term.trim()))
        .map((term) => term.toLowerCase());
      return terms.some((term) => normalizedPrompt.includes(term));
    })
    .slice(0, 6);
}

function inferFallbackAgentSpecs(prompt: string): Array<{
  id: string;
  label: string;
  role: string;
  kind?: WorkflowAgentKind;
  isManager?: boolean;
  agentInstanceId?: string;
}> {
  if (/研究|论文|文献|实验/.test(prompt)) {
    return [
      { id: 'agent-manager', label: '项目经理', role: '任务拆解与协调', isManager: true },
      { id: 'agent-researcher', label: '研究员', role: '资料检索与研究计划' },
      { id: 'agent-analyst', label: '分析员', role: '实验分析与结论整理' },
      { id: 'agent-writer', label: '写作助手', role: '报告撰写与总结' },
    ];
  }
  if (/创意|设计|素材|文案|发布/.test(prompt)) {
    return [
      { id: 'agent-director', label: '创意总监', role: '创意方向制定', isManager: true },
      { id: 'agent-collector', label: '素材收集员', role: '素材与灵感收集' },
      { id: 'agent-designer', label: '视觉设计师', role: '视觉方案设计' },
      { id: 'agent-publisher', label: '运营发布', role: '整理并发布最终内容' },
    ];
  }
  if (/代码|开发|测试|部署|前端|后端/.test(prompt)) {
    return [
      { id: 'agent-architect', label: '架构师', role: '需求拆解与技术方案', isManager: true },
      { id: 'agent-developer', label: '开发工程师', role: '功能实现' },
      { id: 'agent-tester', label: '测试工程师', role: '验证与缺陷反馈' },
      { id: 'agent-deployer', label: '部署运维', role: '部署与交付' },
    ];
  }
  return [
    { id: 'agent-planner', label: '规划 Agent', role: '理解需求并拆分任务', isManager: true },
    { id: 'agent-worker', label: '执行 Agent', role: '执行核心任务' },
    { id: 'agent-reviewer', label: '整理 Agent', role: '审核结果并生成最终输出' },
  ];
}

function inferWorkflowName(prompt: string): string {
  if (/研究|论文|文献/.test(prompt)) return '研究团队工作流';
  if (/创意|设计|文案/.test(prompt)) return '创意团队工作流';
  if (/代码|开发|测试/.test(prompt)) return '软件开发工作流';
  return '多 Agent 工作流';
}

function getMetadataString(metadata: unknown, key: string): string | undefined {
  if (!isRecord(metadata)) return undefined;
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function inferCollaborationPattern(
  nodes: WorkflowDslNode[],
  edges: WorkflowDslEdge[],
  hasCycle: boolean
): string {
  const agentNodes = nodes.filter((node) => node.type === 'agent');
  if (agentNodes.length === 0) return 'blank';
  if (hasCycle) return 'evaluator-optimizer';
  if (agentNodes.some((node) => node.kind === 'judge')) return 'competition';
  if (agentNodes.some((node) => node.kind === 'orchestrator' || node.isManager)) return 'orchestrator-workers';
  if (agentNodes.some((node) => node.kind === 'router') || nodes.some((node) => node.type === 'condition')) return 'routing';

  const outgoingCounts = new Map<string, number>();
  const incomingCounts = new Map<string, number>();
  for (const edge of edges) {
    outgoingCounts.set(edge.from, (outgoingCounts.get(edge.from) ?? 0) + 1);
    incomingCounts.set(edge.to, (incomingCounts.get(edge.to) ?? 0) + 1);
  }
  if (
    agentNodes.length > 1 &&
    ([...outgoingCounts.values()].some((count) => count > 1) ||
      [...incomingCounts.values()].some((count) => count > 1))
  ) {
    return 'parallelization';
  }
  if (agentNodes.length > 1) return 'prompt-chain';
  return 'custom';
}

function normalizeAgentKind(value: unknown, isManager?: boolean): WorkflowAgentKind {
  if (
    value === 'worker' ||
    value === 'router' ||
    value === 'aggregator' ||
    value === 'judge' ||
    value === 'orchestrator' ||
    value === 'evaluator' ||
    value === 'optimizer'
  ) {
    return value;
  }
  return isManager ? 'orchestrator' : 'worker';
}

function normalizeNodeType(value: unknown): WorkflowNodeType {
  if (value === 'start' || value === 'startNode') return 'start';
  if (value === 'condition' || value === 'conditionNode') return 'condition';
  if (value === 'end' || value === 'endNode') return 'end';
  return 'agent';
}

function defaultNodeLabel(type: WorkflowNodeType, index: number): string {
  if (type === 'start') return '用户输入';
  if (type === 'condition') return '条件';
  if (type === 'end') return '最终输出';
  return `Agent ${index + 1}`;
}

function normalizeBranch(branch: unknown, label: unknown): WorkflowEdgeBranch | undefined {
  if (branch === 'yes' || branch === 'no') return branch;
  const text = typeof label === 'string' ? label.toLowerCase() : '';
  if (['yes', 'true', '是', '通过', '可行', '成功'].some((word) => text.includes(word))) return 'yes';
  if (['no', 'false', '否', '不通过', '驳回', '补正', '失败'].some((word) => text.includes(word))) return 'no';
  return undefined;
}

function sanitizeId(value: string, fallback: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized || fallback;
}

function uniqueId(id: string, used: Set<string>): string {
  let candidate = id;
  let index = 2;
  while (used.has(candidate)) {
    candidate = `${id}-${index}`;
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

function detectCycle(nodes: WorkflowDslNode[], edges: WorkflowDslEdge[]): boolean {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(nodeId: string): boolean {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    for (const next of outgoing.get(nodeId) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  }

  return nodes.some((node) => visit(node.id));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
