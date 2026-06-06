import type { Connection, Edge, Node } from '@xyflow/react';
import type {
  ArchitectureAgent,
  ArchitectureEdge,
  ArchitectureNode,
  Lobster,
  WorkflowAgentKind,
  WorkflowDsl,
  WorkflowDslEdge,
  WorkflowDslNode,
  WorkflowValidationIssue,
} from '@/types';

type CanvasNodeData = Record<string, unknown>;
type ConnectionLike = {
  source?: string | null;
  target?: string | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

interface WorkflowBuildInput {
  name: string;
  description?: string;
  nodes: Node[] | ArchitectureNode[];
  edges: Edge[] | ArchitectureEdge[];
  source?: NonNullable<WorkflowDsl['metadata']>['source'];
  collaborationPattern?: string;
}

export interface WorkflowBuildResult {
  dsl: WorkflowDsl;
  errors: WorkflowValidationIssue[];
  warnings: WorkflowValidationIssue[];
}

const START_NODE_TYPE = 'startNode';
const AGENT_NODE_TYPE = 'agentNode';
const CONDITION_NODE_TYPE = 'conditionNode';
const END_NODE_TYPE = 'endNode';

function asNodeData(node: Pick<Node, 'data'> | ArchitectureNode): CanvasNodeData {
  return (node.data ?? {}) as CanvasNodeData;
}

function getNodeType(node: Pick<Node, 'type'> | ArchitectureNode): string {
  return node.type ?? AGENT_NODE_TYPE;
}

function getNodeLabel(node: Pick<Node, 'data' | 'id'> | ArchitectureNode, fallback: string): string {
  const data = asNodeData(node);
  return typeof data.label === 'string' && data.label.trim() ? data.label.trim() : fallback;
}

function getStringList(data: CanvasNodeData, key: string): string[] {
  const value = data[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getEdgeSourceHandle(edge: Edge | ArchitectureEdge): string | null {
  const data = 'data' in edge ? (edge.data as { sourceHandle?: unknown } | undefined) : undefined;
  const direct = 'sourceHandle' in edge ? edge.sourceHandle : undefined;
  const value = direct ?? data?.sourceHandle ?? null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getEdgeLabel(edge: Edge | ArchitectureEdge): string | undefined {
  const direct = 'label' in edge ? edge.label : undefined;
  const data = 'data' in edge ? (edge.data as { label?: unknown } | undefined) : undefined;
  const value = direct ?? data?.label;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getEdgeSource(edge: Edge | ArchitectureEdge): string {
  return edge.source;
}

function getEdgeTarget(edge: Edge | ArchitectureEdge): string {
  return edge.target;
}

function isConcreteAgentInstanceId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const id = value.trim();
  if (!id) return false;
  return !/^(lobster|agent|arch)-/i.test(id);
}

function getLinkedAgentInstanceId(data: CanvasNodeData): string | undefined {
  const linked = data.linkedLobster as { id?: unknown } | null | undefined;
  if (isConcreteAgentInstanceId(linked?.id)) return linked.id.trim();
  if (isConcreteAgentInstanceId(data.linkedLobsterId)) return data.linkedLobsterId.trim();
  return undefined;
}

function getWorkflowAgentKind(data: CanvasNodeData): WorkflowAgentKind | undefined {
  const value = typeof data.kind === 'string' ? data.kind : undefined;
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
  return undefined;
}

function getWorkflowAgentKindLabel(kind?: WorkflowAgentKind): string {
  const labels: Record<WorkflowAgentKind, string> = {
    worker: '执行者',
    router: '路由器',
    aggregator: '汇总者',
    judge: '评审者',
    orchestrator: '编排者',
    evaluator: '评估者',
    optimizer: '优化者',
  };
  return kind ? labels[kind] : '执行者';
}

function sanitizeOutputKey(id: string): string {
  return `${id.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'node'}_output`;
}

function issue(
  code: string,
  message: string,
  extra: Partial<WorkflowValidationIssue> = {}
): WorkflowValidationIssue {
  return { code, message, ...extra };
}

export function resolveWorkflowBranch(edge: Edge | ArchitectureEdge): 'yes' | 'no' | undefined {
  const sourceHandle = getEdgeSourceHandle(edge);
  if (sourceHandle === 'yes' || sourceHandle === 'no') return sourceHandle;

  const label = getEdgeLabel(edge)?.toLowerCase();
  if (!label) return undefined;
  if (['yes', 'true', 'pass', 'ok', '是', '通过', '可行', '同意', '成功'].some((word) => label.includes(word))) {
    return 'yes';
  }
  if (['no', 'false', 'fail', '否', '不通过', '不可行', '驳回', '补正', '失败'].some((word) => label.includes(word))) {
    return 'no';
  }
  return undefined;
}

export function getConnectionValidationError(
  nodes: Node[],
  edges: Edge[],
  connection: Connection | ConnectionLike
): string | null {
  if (!connection.source || !connection.target) return '连接缺少起点或终点';
  if (connection.source === connection.target) return '不能连接到自身';

  const source = nodes.find((node) => node.id === connection.source);
  const target = nodes.find((node) => node.id === connection.target);
  if (!source || !target) return '连接的节点不存在';
  if (source.type === END_NODE_TYPE) return '终点不能作为输出节点';
  if (target.type === START_NODE_TYPE) return '起点不能作为输入节点';

  const duplicated = edges.some((edge) =>
    edge.source === connection.source &&
    edge.target === connection.target &&
    (edge.sourceHandle ?? null) === (connection.sourceHandle ?? null) &&
    (edge.targetHandle ?? null) === (connection.targetHandle ?? null)
  );
  if (duplicated) return '这条连接已经存在';

  if (source.type === CONDITION_NODE_TYPE) {
    const branch = connection.sourceHandle;
    if (branch !== 'yes' && branch !== 'no') return '条件节点只能从“是/否”端口连出';
    const branchUsed = edges.some((edge) => edge.source === source.id && getEdgeSourceHandle(edge) === branch);
    if (branchUsed) return `条件节点的 ${branch === 'yes' ? '是' : '否'} 分支已经连接`;
  }

  return null;
}

export function validateWorkflowGraph(
  nodes: Node[] | ArchitectureNode[],
  edges: Edge[] | ArchitectureEdge[]
): { errors: WorkflowValidationIssue[]; warnings: WorkflowValidationIssue[] } {
  const errors: WorkflowValidationIssue[] = [];
  const warnings: WorkflowValidationIssue[] = [];
  const nodeMap = new Map<string, Node | ArchitectureNode>();
  const seenNodeIds = new Set<string>();

  for (const node of nodes) {
    if (seenNodeIds.has(node.id)) {
      errors.push(issue('duplicate_node_id', `节点 ID 重复：${node.id}`, { nodeId: node.id }));
    }
    seenNodeIds.add(node.id);
    nodeMap.set(node.id, node);
  }

  const startNodes = nodes.filter((node) => getNodeType(node) === START_NODE_TYPE);
  const endNodes = nodes.filter((node) => getNodeType(node) === END_NODE_TYPE);
  const agentNodes = nodes.filter((node) => getNodeType(node) === AGENT_NODE_TYPE);

  if (startNodes.length !== 1) {
    errors.push(issue('invalid_start_count', `工作流必须有且只能有一个起点，当前为 ${startNodes.length} 个`));
  }
  if (endNodes.length < 1) {
    errors.push(issue('missing_end', '工作流至少需要一个终点'));
  }
  if (agentNodes.length < 1) {
    errors.push(issue('missing_agent', '工作流至少需要一个 Agent 节点'));
  }

  const incoming = new Map<string, (Edge | ArchitectureEdge)[]>();
  const outgoing = new Map<string, (Edge | ArchitectureEdge)[]>();
  const edgeKeys = new Set<string>();

  for (const edge of edges) {
    const source = getEdgeSource(edge);
    const target = getEdgeTarget(edge);
    const edgeId = edge.id;
    const sourceNode = nodeMap.get(source);
    const targetNode = nodeMap.get(target);
    const key = `${source}:${getEdgeSourceHandle(edge) ?? ''}->${target}`;

    if (edgeKeys.has(key)) {
      errors.push(issue('duplicate_edge', `重复连接：${source} -> ${target}`, { edgeId }));
    }
    edgeKeys.add(key);

    if (!sourceNode) {
      errors.push(issue('missing_edge_source', `连接 ${edgeId} 的源节点不存在`, { edgeId }));
      continue;
    }
    if (!targetNode) {
      errors.push(issue('missing_edge_target', `连接 ${edgeId} 的目标节点不存在`, { edgeId }));
      continue;
    }
    if (source === target) {
      errors.push(issue('self_loop', `节点不能连接到自身：${source}`, { nodeId: source, edgeId }));
    }
    if (getNodeType(sourceNode) === END_NODE_TYPE) {
      errors.push(issue('end_has_outgoing', '终点不能有输出连接', { nodeId: source, edgeId }));
    }
    if (getNodeType(targetNode) === START_NODE_TYPE) {
      errors.push(issue('start_has_incoming', '起点不能有输入连接', { nodeId: target, edgeId }));
    }

    incoming.set(target, [...(incoming.get(target) ?? []), edge]);
    outgoing.set(source, [...(outgoing.get(source) ?? []), edge]);
  }

  for (const node of nodes) {
    const type = getNodeType(node);
    const inCount = incoming.get(node.id)?.length ?? 0;
    const outCount = outgoing.get(node.id)?.length ?? 0;
    if (type !== START_NODE_TYPE && inCount === 0) {
      errors.push(issue('missing_incoming', `节点“${getNodeLabel(node, node.id)}”没有输入连接`, { nodeId: node.id }));
    }
    if (type !== END_NODE_TYPE && outCount === 0) {
      errors.push(issue('missing_outgoing', `节点“${getNodeLabel(node, node.id)}”没有输出连接`, { nodeId: node.id }));
    }

    if (type === AGENT_NODE_TYPE) {
      const data = asNodeData(node);
      const linkedId = getLinkedAgentInstanceId(data);
      if (!linkedId) {
        warnings.push(issue(
          'agent_not_linked',
          `Agent 节点“${getNodeLabel(node, node.id)}”没有绑定真实 Agent；运行时会作为模拟节点执行。`,
          { nodeId: node.id }
        ));
      }
    }

    if (type === CONDITION_NODE_TYPE) {
      const branchEdges = outgoing.get(node.id) ?? [];
      const branches = branchEdges.map(resolveWorkflowBranch).filter(Boolean);
      if (!branches.includes('yes')) {
        errors.push(issue('condition_missing_yes', `条件节点“${getNodeLabel(node, node.id)}”缺少“是”分支`, { nodeId: node.id }));
      }
      if (!branches.includes('no')) {
        errors.push(issue('condition_missing_no', `条件节点“${getNodeLabel(node, node.id)}”缺少“否”分支`, { nodeId: node.id }));
      }
      if (branchEdges.length > 2) {
        errors.push(issue('condition_too_many_branches', `条件节点“${getNodeLabel(node, node.id)}”最多只能有两个输出分支`, { nodeId: node.id }));
      }
      const uniqueBranches = new Set(branches);
      if (branches.length !== uniqueBranches.size) {
        errors.push(issue('condition_duplicate_branch', `条件节点“${getNodeLabel(node, node.id)}”存在重复分支`, { nodeId: node.id }));
      }
    }
  }

  if (startNodes.length === 1) {
    const startId = startNodes[0].id;
    const reachable = new Set<string>([startId]);
    const queue = [startId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of outgoing.get(current) ?? []) {
        const target = getEdgeTarget(edge);
        if (!reachable.has(target)) {
          reachable.add(target);
          queue.push(target);
        }
      }
    }

    for (const node of nodes) {
      if (!reachable.has(node.id)) {
        errors.push(issue('unreachable_node', `节点“${getNodeLabel(node, node.id)}”无法从起点到达`, { nodeId: node.id }));
      }
    }

    const canReachEnd = new Set<string>(endNodes.map((node) => node.id));
    let changed = true;
    while (changed) {
      changed = false;
      for (const edge of edges) {
        const source = getEdgeSource(edge);
        const target = getEdgeTarget(edge);
        if (canReachEnd.has(target) && !canReachEnd.has(source)) {
          canReachEnd.add(source);
          changed = true;
        }
      }
    }
    for (const node of nodes) {
      if (reachable.has(node.id) && getNodeType(node) !== END_NODE_TYPE && !canReachEnd.has(node.id)) {
        errors.push(issue('no_path_to_end', `节点“${getNodeLabel(node, node.id)}”无法走到终点`, { nodeId: node.id }));
      }
    }
  }

  const cycle = findCycle(nodes, edges);
  if (cycle.length > 0) {
    warnings.push(issue(
      'cycle_detected',
      `检测到回路：${cycle.join(' -> ')}。运行时会使用 maxIterations 限制循环次数。`
    ));
  }

  return { errors, warnings };
}

function findCycle(nodes: Node[] | ArchitectureNode[], edges: Edge[] | ArchitectureEdge[]): string[] {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    outgoing.set(getEdgeSource(edge), [...(outgoing.get(getEdgeSource(edge)) ?? []), getEdgeTarget(edge)]);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];

  function visit(nodeId: string): string[] {
    if (visiting.has(nodeId)) {
      const start = path.indexOf(nodeId);
      return start >= 0 ? [...path.slice(start), nodeId] : [nodeId];
    }
    if (visited.has(nodeId)) return [];

    visiting.add(nodeId);
    path.push(nodeId);
    for (const target of outgoing.get(nodeId) ?? []) {
      const result = visit(target);
      if (result.length > 0) return result;
    }
    path.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
    return [];
  }

  for (const node of nodes) {
    const result = visit(node.id);
    if (result.length > 0) return result;
  }
  return [];
}

export function buildWorkflowDslFromCanvas(input: WorkflowBuildInput): WorkflowBuildResult {
  const { errors, warnings } = validateWorkflowGraph(input.nodes, input.edges);
  const startNode = input.nodes.find((node) => getNodeType(node) === START_NODE_TYPE);
  const cycle = warnings.some((item) => item.code === 'cycle_detected');

  const dslNodes: WorkflowDslNode[] = input.nodes.map((node) => {
    const data = asNodeData(node);
    const type = getNodeType(node);
    const position = 'position' in node ? node.position : node.position;

    if (type === START_NODE_TYPE) {
      return {
        id: node.id,
        type: 'start',
        label: getNodeLabel(node, '用户输入'),
        outputKey: 'user_task',
        position,
      };
    }

    if (type === CONDITION_NODE_TYPE) {
      return {
        id: node.id,
        type: 'condition',
        label: getNodeLabel(node, '条件'),
        expression: typeof data.description === 'string' && data.description.trim()
          ? data.description.trim()
          : getNodeLabel(node, '条件'),
        position,
      };
    }

    if (type === END_NODE_TYPE) {
      return {
        id: node.id,
        type: 'end',
        label: getNodeLabel(node, '输出'),
        resultKey: 'final_output',
        position,
      };
    }

    const agentInstanceId = getLinkedAgentInstanceId(data);
    const inputs = getStringList(data, 'inputs');
    const outputs = getStringList(data, 'outputs');
    const inputContract = inputs.length > 0 ? inputs.join('、') : '上游节点输出或用户任务';
    const outputContract = outputs.length > 0 ? outputs.join('、') : '本节点处理结果';
    const kind = getWorkflowAgentKind(data);

    return {
      id: node.id,
      type: 'agent',
      label: getNodeLabel(node, 'Agent'),
      agentInstanceId,
      role: typeof data.role === 'string' ? data.role : '成员',
      kind,
      inputTemplate: [
        `协作身份：${getWorkflowAgentKindLabel(kind)}`,
        `期望输入：${inputContract}`,
        `期望输出：${outputContract}`,
        '',
        '{{upstream_outputs}}',
      ].join('\n'),
      outputKey: sanitizeOutputKey(node.id),
      isManager: Boolean(data.isManager),
      position,
    };
  });

  const nodeMap = new Map(input.nodes.map((node) => [node.id, node]));
  const dslEdges: WorkflowDslEdge[] = input.edges.map((edge) => {
    const sourceNode = nodeMap.get(getEdgeSource(edge));
    const sourceIsCondition = sourceNode && getNodeType(sourceNode) === CONDITION_NODE_TYPE;
    return {
      id: edge.id,
      from: getEdgeSource(edge),
      to: getEdgeTarget(edge),
      branch: sourceIsCondition ? resolveWorkflowBranch(edge) : undefined,
      label: getEdgeLabel(edge),
    };
  });

  const dsl: WorkflowDsl = {
    schemaVersion: '1.0',
    name: input.name.trim() || '未命名工作流',
    description: input.description?.trim() || '',
    entryNodeId: startNode?.id || 'node-start',
    nodes: dslNodes,
    edges: dslEdges,
    execution: {
      mode: cycle ? 'state-machine' : 'dag',
      maxConcurrency: 2,
      timeoutSec: 1800,
      maxIterations: cycle ? 3 : undefined,
    },
    metadata: {
      source: input.source ?? 'canvas',
      collaborationPattern: input.collaborationPattern,
      warnings,
    },
  };

  return { dsl, errors, warnings };
}

export function buildArchitectureAgentsFromWorkflowDsl(
  dsl: WorkflowDsl,
  lobsters: Lobster[] = []
): ArchitectureAgent[] {
  return dsl.nodes
    .filter((node): node is Extract<WorkflowDslNode, { type: 'agent' }> => node.type === 'agent')
    .map((node) => {
      const lobster = node.agentInstanceId
        ? lobsters.find((item) => item.id === node.agentInstanceId)
        : undefined;
      return {
        id: node.id,
        nodeId: node.id,
        name: node.label,
        role: node.role,
        kind: node.kind,
        status: 'standby' as const,
        isManager: node.isManager,
        inputs: [],
        outputs: [node.outputKey],
        linkedLobsterId: node.agentInstanceId,
        openclawPath: lobster?.openclawPath,
        openclawPort: lobster?.openclawPort,
      };
    });
}

export function buildCanvasGraphFromWorkflowDsl(
  dsl: WorkflowDsl,
  lobsters: Lobster[] = []
): { nodes: ArchitectureNode[]; edges: ArchitectureEdge[] } {
  const positions = computeCanvasPositions(dsl);

  const nodes: ArchitectureNode[] = dsl.nodes.map((node) => {
    const position = node.position ?? positions.get(node.id) ?? { x: 80, y: 240 };
    if (node.type === 'start') {
      return {
        id: node.id,
        type: START_NODE_TYPE,
        position,
        data: { label: node.label },
      };
    }
    if (node.type === 'condition') {
      return {
        id: node.id,
        type: CONDITION_NODE_TYPE,
        position,
        data: { label: node.label, description: node.expression },
      };
    }
    if (node.type === 'end') {
      return {
        id: node.id,
        type: END_NODE_TYPE,
        position,
        data: { label: node.label },
      };
    }

    const linkedLobster = node.agentInstanceId
      ? lobsters.find((lobster) => lobster.id === node.agentInstanceId) ?? null
      : null;
    return {
      id: node.id,
      type: AGENT_NODE_TYPE,
      position,
      data: {
        label: node.label,
        role: node.role,
        kind: node.kind,
        isManager: Boolean(node.isManager),
        inputs: ['输入'],
        outputs: [node.outputKey],
        agentId: node.id,
        isDeletable: true,
        linkedLobster,
        linkedLobsterId: node.agentInstanceId,
      },
    };
  });

  const edges: ArchitectureEdge[] = dsl.edges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    label: edge.label ?? edge.branch,
    sourceHandle: edge.branch ?? null,
    targetHandle: null,
  }));

  return { nodes, edges };
}

function computeCanvasPositions(dsl: WorkflowDsl): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const outgoing = new Map<string, WorkflowDslEdge[]>();
  for (const edge of dsl.edges) {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
  }

  const queue: Array<{ id: string; depth: number; lane: number }> = [
    { id: dsl.entryNodeId, depth: 0, lane: 0 },
  ];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current.id)) continue;
    seen.add(current.id);
    positions.set(current.id, {
      x: 80 + current.depth * 260,
      y: 240 + current.lane * 150,
    });

    const edges = outgoing.get(current.id) ?? [];
    edges.forEach((edge, index) => {
      const laneOffset = edge.branch === 'yes' ? -1 : edge.branch === 'no' ? 1 : index;
      queue.push({
        id: edge.to,
        depth: current.depth + 1,
        lane: current.lane + laneOffset,
      });
    });
  }

  dsl.nodes.forEach((node, index) => {
    if (!positions.has(node.id)) {
      positions.set(node.id, { x: 80 + index * 260, y: 520 });
    }
  });

  return positions;
}
