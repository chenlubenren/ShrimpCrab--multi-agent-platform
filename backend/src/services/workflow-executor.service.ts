import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { agentRunner, type AgentPlatform, type ProviderConfig } from './agent-runner.service.js';
import { getAgentByIdAndUser, readAgentUserConfig } from './agent.service.js';
import { getProviderById } from './provider.service.js';
import { executeCozeAgentTurn } from './coze-market.service.js';
import { buildAgentRuntimePrompt } from './agent-runtime-context.service.js';
import { ensureProjectWorkspace, getProject, touchProject } from './project.service.js';
import { getTeamRuntimePath, resolveStoredPath } from './workspace.service.js';
import type { UserAgentInstance } from '../db/schema.js';

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
export type WorkflowExecutionStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type WorkflowNodeExecutionStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'skipped';

export interface WorkflowDslNode {
  id: string;
  type: WorkflowNodeType;
  label: string;
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
  metadata?: Record<string, unknown>;
}

export interface WorkflowNodeRunState {
  nodeId: string;
  type: WorkflowNodeType;
  label: string;
  status: WorkflowNodeExecutionStatus;
  agentInstanceId?: string;
  agentName?: string;
  role?: string;
  kind?: WorkflowAgentKind;
  task?: string;
  runnerPrompt?: string;
  input?: string;
  output?: string;
  outputFilePath?: string;
  artifacts?: WorkflowArtifact[];
  error?: string;
  startedAt?: string;
  completedAt?: string;
  runCount: number;
}

export interface WorkflowArtifact {
  id: string;
  nodeId: string;
  nodeLabel: string;
  label: string;
  kind: 'node-output' | 'workspace-file';
  path: string;
  relativePath: string;
  size: number;
  createdAt: string;
}

export interface WorkflowExecutionEvent {
  id: string;
  timestamp: string;
  type:
    | 'execution_started'
    | 'execution_completed'
    | 'execution_failed'
    | 'node_ready'
    | 'node_started'
    | 'node_completed'
    | 'node_failed'
    | 'node_skipped'
    | 'branch_selected'
    | 'max_iterations';
  nodeId?: string;
  agentName?: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface WorkflowExecution {
  id: string;
  userId: string;
  architectureId?: string;
  projectId?: string;
  projectName?: string;
  projectWorkspacePath?: string;
  sharedWorkspacePath: string;
  runWorkspacePath: string;
  artifactsPath: string;
  workflowName: string;
  task: string;
  status: WorkflowExecutionStatus;
  dryRun: boolean;
  createdAt: string;
  startedAt?: string;
  updatedAt: string;
  completedAt?: string;
  workflowDsl: WorkflowDsl;
  nodeStates: Record<string, WorkflowNodeRunState>;
  events: WorkflowExecutionEvent[];
  artifacts: WorkflowArtifact[];
  currentNodeIds: string[];
  finalOutput?: string;
  error?: string;
}

export interface StartWorkflowExecutionInput {
  userId: string;
  architectureId?: string;
  projectId?: string;
  workflowDsl: WorkflowDsl;
  task: string;
  dryRun?: boolean;
}

interface RuntimeState {
  execution: WorkflowExecution;
  dsl: WorkflowDsl;
  nodeMap: Map<string, WorkflowDslNode>;
  incoming: Map<string, WorkflowDslEdge[]>;
  outgoing: Map<string, WorkflowDslEdge[]>;
  activeEdges: Set<string>;
  expectedEdges: Set<string>;
  skippedNodes: Set<string>;
  running: Map<string, Promise<void>>;
  outputs: Map<string, string>;
  selectedBranches: Map<string, WorkflowEdgeBranch>;
  sharedWorkspacePath: string;
  runWorkspacePath: string;
  artifactsPath: string;
}

interface WorkspaceFileSnapshot {
  relativePath: string;
  absolutePath: string;
  size: number;
  mtimeMs: number;
  sha256: string;
}

const TERMINAL_NODE_STATUSES = new Set<WorkflowNodeExecutionStatus>(['succeeded', 'failed', 'skipped']);
type RuntimeAgentPlatform = AgentPlatform | 'coze';
const SUPPORTED_PLATFORMS: RuntimeAgentPlatform[] = ['claude-code', 'openclaw', 'codex', 'hermes', 'opencode', 'coze'];
const ARTIFACT_PROMPT_PREVIEW_MAX_BYTES = 6 * 1024;
const ARTIFACT_PROMPT_PREVIEW_MAX_CHARS = 3600;

class WorkflowExecutorService extends EventEmitter {
  private executions = new Map<string, WorkflowExecution>();

  async start(input: StartWorkflowExecutionInput): Promise<WorkflowExecution> {
    const normalizedDsl = normalizeWorkflowDsl(input.workflowDsl);
    const id = `wf_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const workspace = await this.resolveWorkflowWorkspace(input, id);
    const execution: WorkflowExecution = {
      id,
      userId: input.userId,
      architectureId: input.architectureId,
      projectId: workspace.projectId,
      projectName: workspace.projectName,
      projectWorkspacePath: workspace.projectWorkspacePath,
      sharedWorkspacePath: workspace.sharedWorkspacePath,
      runWorkspacePath: workspace.runWorkspacePath,
      artifactsPath: workspace.artifactsPath,
      workflowName: normalizedDsl.name,
      task: input.task,
      status: 'queued',
      dryRun: Boolean(input.dryRun),
      createdAt: now,
      updatedAt: now,
      workflowDsl: normalizedDsl,
      nodeStates: Object.fromEntries(
        normalizedDsl.nodes.map((node) => [
          node.id,
          {
            nodeId: node.id,
            type: node.type,
            label: node.label,
            status: 'pending' as const,
            agentInstanceId: node.agentInstanceId,
            role: node.role,
            kind: node.kind,
            runCount: 0,
          },
        ])
      ),
      events: [],
      artifacts: [],
      currentNodeIds: [],
    };

    this.executions.set(id, execution);
    void this.runExecution(execution).catch((error: unknown) => {
      this.failExecution(execution, error instanceof Error ? error.message : String(error));
    });

    return cloneExecution(execution);
  }

  private async resolveWorkflowWorkspace(
    input: StartWorkflowExecutionInput,
    executionId: string
  ): Promise<{
    projectId?: string;
    projectName?: string;
    projectWorkspacePath?: string;
    runWorkspacePath: string;
    artifactsPath: string;
    sharedWorkspacePath: string;
  }> {
    if (input.projectId) {
      const project = await getProject(input.userId, input.projectId);
      if (!project) {
        throw new Error('项目不存在，或当前用户无权限访问该项目。');
      }

      const projectWorkspacePath = resolveStoredPath(project.workspacePath);
      ensureProjectWorkspace(projectWorkspacePath);
      void touchProject(input.userId, project.id);
      const runWorkspacePath = path.join(projectWorkspacePath, '.openclaw', 'workflow-runs', executionId);
      const artifactsPath = path.join(runWorkspacePath, 'artifacts');
      fs.mkdirSync(artifactsPath, { recursive: true });

      return {
        projectId: project.id,
        projectName: project.name,
        projectWorkspacePath,
        runWorkspacePath,
        artifactsPath,
        sharedWorkspacePath: projectWorkspacePath,
      };
    }

    const runWorkspacePath = getTeamRuntimePath(input.userId, input.architectureId || 'standalone-workflow', executionId);
    const sharedWorkspacePath = path.join(runWorkspacePath, 'workspace');
    const artifactsPath = path.join(runWorkspacePath, 'artifacts');
    fs.mkdirSync(sharedWorkspacePath, { recursive: true });
    fs.mkdirSync(artifactsPath, { recursive: true });

    return {
      runWorkspacePath,
      artifactsPath,
      sharedWorkspacePath,
    };
  }

  get(id: string, userId: string): WorkflowExecution | null {
    const execution = this.executions.get(id);
    if (!execution || execution.userId !== userId) return null;
    return cloneExecution(execution);
  }

  list(userId: string): WorkflowExecution[] {
    return Array.from(this.executions.values())
      .filter((execution) => execution.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(cloneExecution);
  }

  cancel(id: string, userId: string): WorkflowExecution | null {
    const execution = this.executions.get(id);
    if (!execution || execution.userId !== userId) return null;
    if (execution.status === 'running' || execution.status === 'queued') {
      execution.status = 'cancelled';
      execution.updatedAt = new Date().toISOString();
      this.emit('executionUpdated', cloneExecution(execution));
    }
    return cloneExecution(execution);
  }

  private async runExecution(execution: WorkflowExecution): Promise<void> {
    execution.status = 'running';
    execution.startedAt = new Date().toISOString();
    execution.updatedAt = execution.startedAt;
    this.addEvent(execution, {
      type: 'execution_started',
      message: `Workflow "${execution.workflowName}" started.`,
      details: {
        projectId: execution.projectId,
        projectName: execution.projectName,
        sharedWorkspacePath: execution.sharedWorkspacePath,
        runWorkspacePath: execution.runWorkspacePath,
        artifactsPath: execution.artifactsPath,
      },
    });

    const dsl = execution.workflowDsl;
    const nodeMap = new Map(dsl.nodes.map((node) => [node.id, node]));
    const incoming = groupEdgesBy(dsl.edges, 'to');
    const outgoing = groupEdgesBy(dsl.edges, 'from');
    const runtime: RuntimeState = {
      execution,
      dsl,
      nodeMap,
      incoming,
      outgoing,
      activeEdges: new Set<string>(),
      expectedEdges: new Set<string>(),
      skippedNodes: new Set<string>(),
      running: new Map<string, Promise<void>>(),
      outputs: new Map<string, string>(),
      selectedBranches: new Map<string, WorkflowEdgeBranch>(),
      sharedWorkspacePath: execution.sharedWorkspacePath,
      runWorkspacePath: execution.runWorkspacePath,
      artifactsPath: execution.artifactsPath,
    };

    const entry = nodeMap.get(dsl.entryNodeId) ?? dsl.nodes.find((node) => node.type === 'start');
    if (!entry) {
      throw new Error('Workflow DSL has no entry node.');
    }

    execution.nodeStates[entry.id].status = 'ready';

    while (execution.status === 'running') {
      this.markSkippedNodes(runtime);
      this.startReadyNodes(runtime);

      if (runtime.running.size === 0) {
        const pendingCount = Object.values(execution.nodeStates)
          .filter((state) => !TERMINAL_NODE_STATUSES.has(state.status))
          .length;
        if (pendingCount === 0) break;
        throw new Error('Workflow stalled: no runnable nodes remain.');
      }

      await Promise.race(runtime.running.values());
    }

    if (execution.status !== 'running') return;

    const failed = Object.values(execution.nodeStates).find((state) => state.status === 'failed');
    if (failed) {
      throw new Error(failed.error || `Node ${failed.label} failed.`);
    }

    execution.status = 'succeeded';
    execution.completedAt = new Date().toISOString();
    execution.updatedAt = execution.completedAt;
    execution.currentNodeIds = [];
    execution.finalOutput = this.buildFinalOutput(runtime);
    this.addEvent(execution, {
      type: 'execution_completed',
      message: 'Workflow completed.',
      details: { finalOutput: execution.finalOutput },
    });
  }

  private startReadyNodes(runtime: RuntimeState): void {
    const maxConcurrency = Math.max(1, Math.floor(runtime.dsl.execution.maxConcurrency || 1));
    const available = maxConcurrency - runtime.running.size;
    if (available <= 0) return;

    const readyNodes = this.getReadyNodes(runtime).slice(0, available);
    for (const node of readyNodes) {
      const state = runtime.execution.nodeStates[node.id];
      state.status = 'running';
      state.startedAt = new Date().toISOString();
      state.runCount += 1;
      state.input = this.buildNodeInput(runtime, node);
      state.task = this.buildDisplayNodeTask(runtime, node, state.input);
      state.runnerPrompt = this.buildAgentRunnerPrompt(runtime, node, state.input);
      if (node.type !== 'condition') {
        for (const edge of runtime.outgoing.get(node.id) ?? []) {
          runtime.expectedEdges.add(edge.id);
        }
      }
      runtime.execution.currentNodeIds = this.getRunningNodeIds(runtime.execution);
      this.addEvent(runtime.execution, {
        type: 'node_started',
        nodeId: node.id,
        agentName: state.agentName ?? node.label,
        message: `${node.label} started.`,
        details: { task: state.task, runCount: state.runCount, kind: node.kind },
      });

      const promise = this.executeNode(runtime, node)
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          this.markNodeFailed(runtime, node, message);
        })
        .finally(() => {
          runtime.running.delete(node.id);
          runtime.execution.currentNodeIds = this.getRunningNodeIds(runtime.execution);
          runtime.execution.updatedAt = new Date().toISOString();
          this.emit('executionUpdated', cloneExecution(runtime.execution));
        });

      runtime.running.set(node.id, promise);
    }
  }

  private getReadyNodes(runtime: RuntimeState): WorkflowDslNode[] {
    return runtime.dsl.nodes.filter((node) => {
      const state = runtime.execution.nodeStates[node.id];
      if (state.status !== 'pending' && state.status !== 'ready') return false;
      if (runtime.skippedNodes.has(node.id)) return false;
      if (state.runCount >= this.getNodeMaxRuns(runtime, node.id)) return false;

      const incoming = runtime.incoming.get(node.id) ?? [];
      if (incoming.length === 0) {
        return node.id === runtime.dsl.entryNodeId || node.type === 'start';
      }

      const relevantEdges = incoming.filter((edge) => runtime.activeEdges.has(edge.id));
      if (relevantEdges.length === 0) return false;
      const blockingEdges = incoming.filter((edge) =>
        runtime.activeEdges.has(edge.id) || runtime.expectedEdges.has(edge.id)
      );
      return blockingEdges.every((edge) => {
        const source = runtime.execution.nodeStates[edge.from];
        return source?.status === 'succeeded' || source?.status === 'skipped';
      });
    }).map((node) => {
      const state = runtime.execution.nodeStates[node.id];
      if (state.status === 'pending') {
        state.status = 'ready';
        this.addEvent(runtime.execution, {
          type: 'node_ready',
          nodeId: node.id,
          message: `${node.label} is ready.`,
        });
      }
      return node;
    });
  }

  private async executeNode(runtime: RuntimeState, node: WorkflowDslNode): Promise<void> {
    if (node.type === 'start') {
      const output = runtime.execution.task;
      this.markNodeSucceeded(runtime, node, output, this.persistNodeOutput(runtime, node, output));
      return;
    }

    if (node.type === 'condition') {
      const branch = this.evaluateCondition(runtime, node);
      runtime.selectedBranches.set(node.id, branch);
      this.activateOutgoingEdges(runtime, node, branch);
      const output = `branch:${branch}`;
      this.markNodeSucceeded(runtime, node, output, this.persistNodeOutput(runtime, node, output));
      this.addEvent(runtime.execution, {
        type: 'branch_selected',
        nodeId: node.id,
        message: `${node.label} selected "${branch}" branch.`,
        details: { branch, expression: node.expression },
      });
      return;
    }

    if (node.type === 'end') {
      const output = this.buildNodeInput(runtime, node);
      this.markNodeSucceeded(runtime, node, output, this.persistNodeOutput(runtime, node, output));
      runtime.execution.finalOutput = output;
      return;
    }

    const state = runtime.execution.nodeStates[node.id];
    const beforeFiles = this.snapshotWorkspace(runtime.sharedWorkspacePath);
    const output = await this.runAgentNode(runtime, node, state.runnerPrompt || state.input || runtime.execution.task);
    const artifacts = [
      ...this.collectWorkspaceFileArtifacts(runtime, node, beforeFiles),
      ...this.persistNodeOutput(runtime, node, output),
    ];
    this.markNodeSucceeded(runtime, node, output, artifacts);
  }

  private async runAgentNode(
    runtime: RuntimeState,
    node: WorkflowDslNode,
    task: string
  ): Promise<string> {
    const state = runtime.execution.nodeStates[node.id];
    if (!node.agentInstanceId || runtime.execution.dryRun) {
      state.agentName = node.label;
      await sleep(Number(process.env.WORKFLOW_DRY_RUN_NODE_DELAY_MS || 120));
      const outputLines = [
        `[${node.label}] dry-run completed.`,
        `Role: ${node.role || node.label}`,
        `Task: ${state.task || task}`,
      ];

      if (process.env.WORKFLOW_DRY_RUN_WRITE_HANDOFF === '1') {
        const handoffPath = this.writeFallbackHandoff(runtime, node, state.task || task, 'dry-run handoff');
        outputLines.push(`Handoff file: ${handoffPath}`);
      }

      return outputLines.join('\n');
    }

    const agent = await getAgentByIdAndUser(node.agentInstanceId, runtime.execution.userId);
    if (!agent) {
      return this.runUnboundAgentFallback(
        runtime,
        node,
        `绑定的 Agent 不存在或当前用户无权限：${node.agentInstanceId}`
      );
    }

    state.agentName = agent.name;
    const { platform, providerConfig } = await this.resolveAgentRuntime(agent, runtime.execution.userId);
    const workflowStateDir = path.join(runtime.runWorkspacePath, 'agent-state', agent.id);
    const workflowProviderConfig: ProviderConfig | undefined = providerConfig
      ? {
          ...providerConfig,
          stateDir: workflowStateDir,
        }
      : platform === 'openclaw'
        ? {
            apiKey: '',
            stateDir: workflowStateDir,
          }
      : undefined;
    const runtimePrompt = buildAgentRuntimePrompt(agent, {
      userMessage: task,
      mode: 'workflow',
      platform,
      providerConfig: workflowProviderConfig,
      extraInstructions: [
        `Workflow execution id: ${runtime.execution.id}`,
        `Workflow name: ${runtime.dsl.name}`,
        `Workflow node: ${node.label}`,
        `Shared project workspace path: ${runtime.sharedWorkspacePath}`,
        `Workflow run workspace path: ${runtime.runWorkspacePath}`,
        `Workflow artifacts path: ${runtime.artifactsPath}`,
        'All workflow agents in this run share the shared project workspace. Read upstream files from that workspace and write handoff files there when the next node should use them.',
        'When producing a durable deliverable, save it as a real file in the shared workspace or the artifacts directory, then mention the exact path in your result.',
        'This is a single node execution. Do not execute downstream nodes yourself.',
      ],
    });
    if (platform === 'coze') {
      return executeCozeAgentTurn(agent, {
        userId: runtime.execution.userId,
        conversationId: runtime.execution.id,
        message: runtimePrompt,
      });
    }

    try {
      return await agentRunner.executeMessage(
        agent.id,
        platform,
        runtime.sharedWorkspacePath,
        runtimePrompt,
        workflowProviderConfig,
        Math.max(1, Math.floor(runtime.dsl.execution.timeoutSec || 1800)) * 1000
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!shouldFallbackOnCliError(message)) {
        throw error;
      }
      this.addEvent(runtime.execution, {
        type: 'node_completed',
        nodeId: node.id,
        agentName: agent.name,
        message: `${agent.name} 的 CLI 不可用，已降级为模拟执行。`,
        details: { platform, error: message },
      });
      await sleep(Number(process.env.WORKFLOW_DRY_RUN_NODE_DELAY_MS || 120));
      const fallbackTask = runtime.execution.nodeStates[node.id].task || task;
      const handoffPath = this.writeFallbackHandoff(
        runtime,
        node,
        fallbackTask,
        'CLI unavailable fallback handoff',
        [`Platform: ${platform}`, `Reason: ${message}`]
      );
      return [
        `[${agent.name}] CLI unavailable fallback completed.`,
        `Platform: ${platform}`,
        `Reason: ${message}`,
        `Task: ${fallbackTask}`,
        `Handoff file: ${handoffPath}`,
      ].join('\n');
    }
  }

  private async runUnboundAgentFallback(
    runtime: RuntimeState,
    node: WorkflowDslNode,
    reason: string
  ): Promise<string> {
    const state = runtime.execution.nodeStates[node.id];
    state.agentName = node.label;
    this.addEvent(runtime.execution, {
      type: 'node_completed',
      nodeId: node.id,
      agentName: node.label,
      message: `${node.label} 未绑定可执行 Agent，已按模拟节点执行。`,
      details: { reason },
    });
    await sleep(Number(process.env.WORKFLOW_DRY_RUN_NODE_DELAY_MS || 120));
    const fallbackTask = state.task || runtime.execution.task;
    const handoffPath = this.writeFallbackHandoff(
      runtime,
      node,
      fallbackTask,
      'unbound-agent fallback handoff',
      [`Reason: ${reason}`]
    );
    return [
      `[${node.label}] unbound-agent fallback completed.`,
      `Role: ${node.role || node.label}`,
      `Reason: ${reason}`,
      `Task: ${fallbackTask}`,
      `Handoff file: ${handoffPath}`,
    ].join('\n');
  }

  private writeFallbackHandoff(
    runtime: RuntimeState,
    node: WorkflowDslNode,
    task: string,
    title: string,
    extraLines: string[] = []
  ): string {
    const state = runtime.execution.nodeStates[node.id];
    const handoffDir = path.join(runtime.sharedWorkspacePath, 'handoff');
    fs.mkdirSync(handoffDir, { recursive: true });
    const handoffPath = path.join(
      handoffDir,
      `${sanitizeFileName(node.id)}-run-${Math.max(1, state.runCount)}.md`
    );
    fs.writeFileSync(
      handoffPath,
      [
        `# ${node.label} ${title}`,
        '',
        `Workflow: ${runtime.dsl.name}`,
        `Execution: ${runtime.execution.id}`,
        `Node: ${node.id}`,
        `Run: ${Math.max(1, state.runCount)}`,
        ...extraLines,
        '',
        `Task: ${task}`,
        '',
      ].join('\n'),
      'utf-8'
    );
    return handoffPath;
  }

  private async resolveAgentRuntime(
    agent: UserAgentInstance,
    userId: string
  ): Promise<{ platform: RuntimeAgentPlatform; providerConfig?: ProviderConfig }> {
    const config = readAgentUserConfig(agent);
    const platform = normalizeAgentPlatform(config.platform || getPlatformFromManifest(agent.manifest) || 'openclaw');
    const providerId = config.providerId ?? agent.providerId ?? null;
    if (!providerId) return { platform };

    const provider = await getProviderById(providerId, userId);
    if (!provider) return { platform };

    const models = parseProviderModels(provider.models);
    const selectedModel = typeof config.model === 'string' && config.model.trim()
      ? config.model.trim()
      : undefined;

    return {
      platform,
      providerConfig: {
        apiKey: provider.apiKey,
        baseUrl: provider.baseUrl || undefined,
        models: selectedModel
          ? [selectedModel, ...models.filter((model) => model !== selectedModel)]
          : models,
        providerType: provider.type,
      },
    };
  }

  private markNodeSucceeded(
    runtime: RuntimeState,
    node: WorkflowDslNode,
    output: string,
    artifacts: WorkflowArtifact[] = []
  ): void {
    const state = runtime.execution.nodeStates[node.id];
    state.status = 'succeeded';
    state.output = output;
    state.artifacts = artifacts;
    state.outputFilePath = artifacts.find((artifact) => artifact.kind === 'node-output')?.path;
    state.completedAt = new Date().toISOString();
    runtime.outputs.set(node.id, output);
    if (artifacts.length > 0) {
      runtime.execution.artifacts.push(...artifacts);
    }
    if (node.type !== 'condition') {
      this.activateOutgoingEdges(runtime, node);
    }
    this.addEvent(runtime.execution, {
      type: 'node_completed',
      nodeId: node.id,
      agentName: state.agentName ?? node.label,
      message: `${node.label} completed.`,
      details: {
        output,
        outputFilePath: state.outputFilePath,
        artifacts,
      },
    });
  }

  private markNodeFailed(runtime: RuntimeState, node: WorkflowDslNode, error: string): void {
    const state = runtime.execution.nodeStates[node.id];
    state.status = 'failed';
    state.error = error;
    state.completedAt = new Date().toISOString();
    runtime.execution.status = 'failed';
    runtime.execution.error = error;
    runtime.execution.completedAt = new Date().toISOString();
    runtime.execution.updatedAt = runtime.execution.completedAt;
    this.addEvent(runtime.execution, {
      type: 'node_failed',
      nodeId: node.id,
      agentName: state.agentName ?? node.label,
      message: `${node.label} failed: ${error}`,
    });
    this.addEvent(runtime.execution, {
      type: 'execution_failed',
      message: `Workflow failed at ${node.label}.`,
      details: { error },
    });
  }

  private failExecution(execution: WorkflowExecution, error: string): void {
    execution.status = 'failed';
    execution.error = error;
    execution.completedAt = new Date().toISOString();
    execution.updatedAt = execution.completedAt;
    execution.currentNodeIds = [];
    this.addEvent(execution, {
      type: 'execution_failed',
      message: error,
    });
  }

  private activateOutgoingEdges(
    runtime: RuntimeState,
    node: WorkflowDslNode,
    branch?: WorkflowEdgeBranch
  ): void {
    const edges = runtime.outgoing.get(node.id) ?? [];
    const selectedEdges = node.type === 'condition'
      ? edges.filter((edge) => edge.branch === branch)
      : edges;

    let activatedCount = 0;
    for (const edge of selectedEdges) {
      const targetState = runtime.execution.nodeStates[edge.to];
      if (!targetState) continue;
      if (targetState.runCount >= this.getNodeMaxRuns(runtime, edge.to)) {
        this.addEvent(runtime.execution, {
          type: 'max_iterations',
          nodeId: edge.to,
          message: `${targetState.label} reached max iterations and will not be scheduled again.`,
        });
        continue;
      }
      runtime.activeEdges.add(edge.id);
      activatedCount += 1;
      if (
        runtime.dsl.execution.mode === 'state-machine' &&
        targetState.status === 'succeeded' &&
        targetState.runCount < this.getNodeMaxRuns(runtime, edge.to)
      ) {
        targetState.status = 'pending';
        targetState.startedAt = undefined;
        targetState.completedAt = undefined;
      }
    }

    if (node.type === 'condition' && activatedCount === 0) {
      const fallback = edges.find((edge) => edge.branch && edge.branch !== branch);
      if (fallback) {
        runtime.activeEdges.add(fallback.id);
      }
    }
  }

  private markSkippedNodes(runtime: RuntimeState): void {
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of runtime.dsl.nodes) {
        const state = runtime.execution.nodeStates[node.id];
        if (TERMINAL_NODE_STATUSES.has(state.status) || state.status === 'running') continue;
        if (node.id === runtime.dsl.entryNodeId) continue;

        const incoming = runtime.incoming.get(node.id) ?? [];
        if (incoming.length === 0) continue;
        const everySourceTerminal = incoming.every((edge) => {
          const sourceState = runtime.execution.nodeStates[edge.from];
          return sourceState && TERMINAL_NODE_STATUSES.has(sourceState.status);
        });
        const hasActiveIncoming = incoming.some((edge) => runtime.activeEdges.has(edge.id));
        if (everySourceTerminal && !hasActiveIncoming) {
          state.status = 'skipped';
          state.completedAt = new Date().toISOString();
          runtime.skippedNodes.add(node.id);
          this.addEvent(runtime.execution, {
            type: 'node_skipped',
            nodeId: node.id,
            message: `${node.label} skipped because no active branch reached it.`,
          });
          changed = true;
        }
      }
    }
  }

  private persistNodeOutput(runtime: RuntimeState, node: WorkflowDslNode, output: string): WorkflowArtifact[] {
    const nodeDir = path.join(runtime.artifactsPath, 'nodes');
    fs.mkdirSync(nodeDir, { recursive: true });
    const state = runtime.execution.nodeStates[node.id];
    const outputPath = path.join(
      nodeDir,
      `${sanitizeFileName(node.id)}-run-${Math.max(1, state.runCount)}.md`
    );
    const content = [
      `# ${node.label}`,
      '',
      `- Workflow: ${runtime.dsl.name}`,
      `- Execution: ${runtime.execution.id}`,
      `- Node: ${node.id}`,
      `- Run: ${Math.max(1, state.runCount)}`,
      `- Completed: ${new Date().toISOString()}`,
      '',
      output,
      '',
    ].join('\n');
    fs.writeFileSync(outputPath, content, 'utf-8');
    return [
      this.buildArtifact(runtime, node, 'node-output', outputPath, `${node.label} output`),
    ];
  }

  private snapshotWorkspace(workspacePath: string): Map<string, WorkspaceFileSnapshot> {
    const snapshot = new Map<string, WorkspaceFileSnapshot>();
    if (!fs.existsSync(workspacePath)) return snapshot;

    const walk = (dirPath: string) => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const absolutePath = path.join(dirPath, entry.name);
        const relativePath = normalizeRelativePath(path.relative(workspacePath, absolutePath));
        if (!relativePath || shouldIgnoreWorkflowFile(relativePath)) continue;

        if (entry.isDirectory()) {
          walk(absolutePath);
          continue;
        }
        if (!entry.isFile()) continue;

        const stats = fs.statSync(absolutePath);
        snapshot.set(relativePath, {
          relativePath,
          absolutePath,
          size: stats.size,
          mtimeMs: stats.mtimeMs,
          sha256: hashFile(absolutePath),
        });
      }
    };

    walk(workspacePath);
    return snapshot;
  }

  private collectWorkspaceFileArtifacts(
    runtime: RuntimeState,
    node: WorkflowDslNode,
    beforeSnapshot: Map<string, WorkspaceFileSnapshot>
  ): WorkflowArtifact[] {
    const afterSnapshot = this.snapshotWorkspace(runtime.sharedWorkspacePath);
    const artifacts: WorkflowArtifact[] = [];

    for (const [relativePath, after] of afterSnapshot.entries()) {
      const before = beforeSnapshot.get(relativePath);
      if (before && before.size === after.size && before.mtimeMs === after.mtimeMs && before.sha256 === after.sha256) {
        continue;
      }
      artifacts.push(this.buildArtifact(
        runtime,
        node,
        'workspace-file',
        after.absolutePath,
        before ? `${node.label} updated ${relativePath}` : `${node.label} created ${relativePath}`
      ));
    }

    return artifacts.slice(0, 50);
  }

  private buildArtifact(
    runtime: RuntimeState,
    node: WorkflowDslNode,
    kind: WorkflowArtifact['kind'],
    filePath: string,
    label: string
  ): WorkflowArtifact {
    const stats = fs.statSync(filePath);
    const relativeBase = kind === 'workspace-file'
      ? runtime.sharedWorkspacePath
      : runtime.runWorkspacePath;
    return {
      id: `artifact_${node.id}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      nodeId: node.id,
      nodeLabel: node.label,
      label,
      kind,
      path: filePath,
      relativePath: normalizeRelativePath(path.relative(relativeBase, filePath)),
      size: stats.size,
      createdAt: new Date().toISOString(),
    };
  }

  private buildNodeInput(runtime: RuntimeState, node: WorkflowDslNode): string {
    const incomingEdges = (runtime.incoming.get(node.id) ?? [])
      .filter((edge) => runtime.activeEdges.has(edge.id));

    if (incomingEdges.length === 0) {
      return runtime.execution.task;
    }

    return incomingEdges
      .map((edge) => {
        const source = runtime.nodeMap.get(edge.from);
        const sourceState = runtime.execution.nodeStates[edge.from];
        const output = runtime.outputs.get(edge.from) || '';
        const artifacts = formatArtifactsForPrompt(sourceState?.artifacts || []);
        return [
          `## ${source?.label || edge.from}`,
          output,
          artifacts ? `\n### Handoff files\n${artifacts}` : '',
        ].filter(Boolean).join('\n');
      })
      .join('\n\n');
  }

  private buildDisplayNodeTask(runtime: RuntimeState, node: WorkflowDslNode, input: string): string {
    if (node.type === 'start') return `接收用户任务：${runtime.execution.task}`;
    if (node.type === 'condition') return `判断分支：${node.expression || node.label}`;
    if (node.type === 'end') return '汇总上游结果并生成最终输出。';
    return `${node.role || node.label}：处理来自上游的任务输入。${input ? ` 输入摘要：${truncate(input, 160)}` : ''}`;
  }

  private buildAgentRunnerPrompt(runtime: RuntimeState, node: WorkflowDslNode, input: string): string {
    if (node.type !== 'agent') return input;
    const template = node.inputTemplate || '{{upstream_outputs}}';
    const rendered = template
      .replaceAll('{{user_task}}', runtime.execution.task)
      .replaceAll('{{upstream_outputs}}', input);

    return [
      `You are executing one node in a multi-agent workflow.`,
      `Workflow: ${runtime.dsl.name}`,
      `Node: ${node.label}`,
      `Role: ${node.role || node.label}`,
      `Collaboration kind: ${node.kind || 'worker'}`,
      `Original user task: ${runtime.execution.task}`,
      `Shared project workspace: ${runtime.sharedWorkspacePath}`,
      `Workflow artifacts directory: ${runtime.artifactsPath}`,
      '',
      'Use the shared project workspace for file handoff. If an upstream node created or updated files, inspect those files before continuing.',
      'If this node creates a deliverable for downstream nodes, write it as a real file and mention its path in your result.',
      '',
      'Input from upstream nodes:',
      rendered,
      '',
      'Return only your result for this node. Do not execute downstream nodes.',
    ].join('\n');
  }

  private evaluateCondition(runtime: RuntimeState, node: WorkflowDslNode): WorkflowEdgeBranch {
    const text = this.buildNodeInput(runtime, node).toLowerCase();
    const noPhraseSignals = ['不通过', '失败', '退回', '修正'];
    const noWordSignals = ['retry', 'revise', 'fail', 'failed', 'no'];
    const hasNoPhrase = noPhraseSignals.some((signal) => text.includes(signal));
    const hasNoWord = noWordSignals.some((signal) => new RegExp(`\\b${signal}\\b`, 'i').test(text));
    const branch: WorkflowEdgeBranch = hasNoPhrase || hasNoWord ? 'no' : 'yes';
    const candidateEdges = runtime.outgoing.get(node.id) ?? [];
    const selectedEdges = candidateEdges.filter((edge) => edge.branch === branch);
    const maxIterations = runtime.dsl.execution.maxIterations ?? 3;
    if (
      branch === 'no' &&
      selectedEdges.length > 0 &&
      selectedEdges.every((edge) => (runtime.execution.nodeStates[edge.to]?.runCount ?? 0) >= maxIterations)
    ) {
      return 'yes';
    }
    return branch;
  }

  private getNodeMaxRuns(runtime: RuntimeState, nodeId: string): number {
    const node = runtime.nodeMap.get(nodeId);
    if (!node) return 1;
    if (runtime.dsl.execution.mode === 'state-machine') {
      return Math.max(1, runtime.dsl.execution.maxIterations ?? 3);
    }
    return 1;
  }

  private getRunningNodeIds(execution: WorkflowExecution): string[] {
    return Object.values(execution.nodeStates)
      .filter((state) => state.status === 'running')
      .map((state) => state.nodeId);
  }

  private buildFinalOutput(runtime: RuntimeState): string {
    const endNodes = runtime.dsl.nodes.filter((node) => node.type === 'end');
    const outputs = endNodes
      .map((node) => runtime.outputs.get(node.id))
      .filter((output): output is string => Boolean(output && output.trim()));
    if (outputs.length > 0) return outputs.join('\n\n');
    return Array.from(runtime.outputs.entries())
      .map(([nodeId, output]) => `## ${runtime.nodeMap.get(nodeId)?.label || nodeId}\n${output}`)
      .join('\n\n');
  }

  private addEvent(
    execution: WorkflowExecution,
    event: Omit<WorkflowExecutionEvent, 'id' | 'timestamp'>
  ): void {
    execution.events.push({
      id: `evt_${execution.events.length + 1}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...event,
    });
    execution.updatedAt = new Date().toISOString();
    this.emit('executionUpdated', cloneExecution(execution));
  }
}

function normalizeWorkflowDsl(raw: WorkflowDsl): WorkflowDsl {
  if (!raw || raw.schemaVersion !== '1.0') {
    throw new Error('Unsupported Workflow DSL schemaVersion.');
  }
  if (!Array.isArray(raw.nodes) || raw.nodes.length === 0) {
    throw new Error('Workflow DSL must include nodes.');
  }
  if (!Array.isArray(raw.edges)) {
    throw new Error('Workflow DSL edges must be an array.');
  }
  const nodeIds = new Set(raw.nodes.map((node) => node.id));
  for (const edge of raw.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new Error(`Workflow edge references missing node: ${edge.id}`);
    }
  }
  return {
    ...raw,
    execution: {
      mode: raw.execution?.mode || 'dag',
      maxConcurrency: Math.max(1, Math.floor(raw.execution?.maxConcurrency || 1)),
      timeoutSec: Math.max(1, Math.floor(raw.execution?.timeoutSec || 1800)),
      maxIterations: raw.execution?.maxIterations,
    },
  };
}

function groupEdgesBy(edges: WorkflowDslEdge[], key: 'from' | 'to'): Map<string, WorkflowDslEdge[]> {
  const grouped = new Map<string, WorkflowDslEdge[]>();
  for (const edge of edges) {
    grouped.set(edge[key], [...(grouped.get(edge[key]) ?? []), edge]);
  }
  return grouped;
}

function getPlatformFromManifest(manifestJson?: string): string | null {
  if (!manifestJson) return null;
  try {
    const manifest = JSON.parse(manifestJson);
    return typeof manifest?.entrypoint?.type === 'string' ? manifest.entrypoint.type : null;
  } catch {
    return null;
  }
}

function normalizeAgentPlatform(value: string): RuntimeAgentPlatform {
  return SUPPORTED_PLATFORMS.includes(value as RuntimeAgentPlatform)
    ? value as RuntimeAgentPlatform
    : 'openclaw';
}

function normalizeModelId(model: unknown): string {
  if (typeof model === 'string') return model;
  if (model && typeof model === 'object') {
    const value = model as { id?: unknown; name?: unknown };
    if (typeof value.id === 'string') return value.id;
    if (typeof value.name === 'string') return value.name;
  }
  return '';
}

function parseProviderModels(rawModels?: string | null): string[] {
  if (!rawModels) return [];
  try {
    const parsed = JSON.parse(rawModels);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeModelId).filter(Boolean);
  } catch {
    return [];
  }
}

function sanitizeFileName(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'node';
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '');
}

function hashFile(filePath: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function shouldIgnoreWorkflowFile(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  return normalized === '.openclaw-project.json' ||
    normalized.startsWith('.git/') ||
    normalized.startsWith('.openclaw/') ||
    normalized.startsWith('node_modules/') ||
    normalized.startsWith('.next/') ||
    normalized.startsWith('dist/') ||
    normalized.startsWith('build/');
}

function formatArtifactsForPrompt(artifacts: WorkflowArtifact[]): string {
  if (artifacts.length === 0) return '';
  return artifacts
    .map((artifact) => {
      const lines = [
        `- ${artifact.label}`,
        `  - kind: ${artifact.kind}`,
        `  - path: ${artifact.path}`,
        `  - relativePath: ${artifact.relativePath}`,
        `  - size: ${artifact.size} bytes`,
      ];
      const preview = readArtifactPromptPreview(artifact);
      if (preview) {
        lines.push(
          '  - contentPreview:',
          '    ```',
          indentForPrompt(preview, '    '),
          '    ```'
        );
      }
      return lines.join('\n');
    })
    .join('\n');
}

function readArtifactPromptPreview(artifact: WorkflowArtifact): string {
  try {
    if (!artifact.path || !fs.existsSync(artifact.path)) return '';
    const fd = fs.openSync(artifact.path, 'r');
    try {
      const buffer = Buffer.alloc(Math.min(artifact.size || ARTIFACT_PROMPT_PREVIEW_MAX_BYTES, ARTIFACT_PROMPT_PREVIEW_MAX_BYTES));
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
      if (bytesRead <= 0) return '';
      const slice = buffer.subarray(0, bytesRead);
      if (slice.includes(0)) return '[binary content omitted]';
      let text = slice.toString('utf-8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
      if (!text.trim()) return '';
      if (text.length > ARTIFACT_PROMPT_PREVIEW_MAX_CHARS) {
        text = `${text.slice(0, ARTIFACT_PROMPT_PREVIEW_MAX_CHARS)}\n...[truncated]`;
      } else if (artifact.size > bytesRead) {
        text = `${text}\n...[truncated]`;
      }
      return text;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return '';
  }
}

function indentForPrompt(value: string, prefix: string): string {
  return value.split('\n').map((line) => `${prefix}${line}`).join('\n');
}

function cloneExecution(execution: WorkflowExecution): WorkflowExecution {
  const cloned = JSON.parse(JSON.stringify(execution)) as WorkflowExecution;
  for (const state of Object.values(cloned.nodeStates)) {
    delete state.runnerPrompt;
  }
  return cloned;
}

function shouldFallbackOnCliError(message: string): boolean {
  if (process.env.WORKFLOW_DISABLE_CLI_FALLBACK === '1') return false;
  return /ENOENT|not installed|not in PATH|command not found|not recognized|not logged in|please run \/login|authentication|unauthorized|api key|missing credentials|timed out/i.test(message);
}

function truncate(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const workflowExecutor = new WorkflowExecutorService();
export default workflowExecutor;
