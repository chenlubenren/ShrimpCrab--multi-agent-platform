import fs from 'fs';
import path from 'path';
import { workflowExecutor, type WorkflowDsl } from '../services/workflow-executor.service.js';

process.env.WORKFLOW_DRY_RUN_WRITE_HANDOFF = '1';
process.env.WORKFLOW_DRY_RUN_NODE_DELAY_MS = '1';

const workflowDsl: WorkflowDsl = {
  schemaVersion: '1.0',
  name: 'Smoke Parallel Workflow Handoff',
  description: 'Verifies that parallel upstream agents can hand off files to one downstream aggregator.',
  entryNodeId: 'node-start',
  nodes: [
    { id: 'node-start', type: 'start', label: 'Start' },
    {
      id: 'agent-research',
      type: 'agent',
      label: 'Research Agent',
      role: 'Create a research handoff file for the aggregator.',
      kind: 'worker',
    },
    {
      id: 'agent-design',
      type: 'agent',
      label: 'Design Agent',
      role: 'Create a design handoff file for the aggregator.',
      kind: 'worker',
    },
    {
      id: 'agent-aggregator',
      type: 'agent',
      label: 'Aggregator Agent',
      role: 'Read all upstream handoff files and merge both branches.',
      kind: 'aggregator',
    },
    { id: 'node-end', type: 'end', label: 'End' },
  ],
  edges: [
    { id: 'edge-start-research', from: 'node-start', to: 'agent-research' },
    { id: 'edge-start-design', from: 'node-start', to: 'agent-design' },
    { id: 'edge-research-aggregator', from: 'agent-research', to: 'agent-aggregator' },
    { id: 'edge-design-aggregator', from: 'agent-design', to: 'agent-aggregator' },
    { id: 'edge-aggregator-end', from: 'agent-aggregator', to: 'node-end' },
  ],
  execution: {
    mode: 'dag',
    maxConcurrency: 2,
    timeoutSec: 60,
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForExecution(id: string, userId: string) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const execution = workflowExecutor.get(id, userId);
    if (!execution) throw new Error(`Execution disappeared: ${id}`);
    if (!['queued', 'running'].includes(execution.status)) return execution;
    await sleep(25);
  }
  throw new Error(`Timed out waiting for execution ${id}`);
}

function requireHandoff(execution: Awaited<ReturnType<typeof waitForExecution>>, nodeId: string) {
  const state = execution.nodeStates[nodeId];
  const handoff = state.artifacts?.find(
    (artifact) => artifact.kind === 'workspace-file' && artifact.relativePath.startsWith('handoff/')
  );
  if (!handoff) {
    throw new Error(`${nodeId} did not record a handoff workspace-file artifact.`);
  }
  if (!fs.existsSync(handoff.path)) {
    throw new Error(`${nodeId} handoff artifact file does not exist: ${handoff.path}`);
  }
  return handoff;
}

async function main() {
  const userId = `smoke_parallel_${Date.now()}`;
  const started = await workflowExecutor.start({
    userId,
    architectureId: 'smoke-parallel-handoff',
    workflowDsl,
    task: 'Split this product planning task into research and design work, then aggregate both files.',
    dryRun: true,
  });
  const execution = await waitForExecution(started.id, userId);

  if (execution.status !== 'succeeded') {
    throw new Error(`Expected succeeded, got ${execution.status}: ${execution.error || ''}`);
  }

  const researchHandoff = requireHandoff(execution, 'agent-research');
  const designHandoff = requireHandoff(execution, 'agent-design');
  const aggregatorState = execution.nodeStates['agent-aggregator'];
  const aggregatorInput = aggregatorState.input || '';

  for (const artifact of [researchHandoff, designHandoff]) {
    if (!aggregatorInput.includes(artifact.path)) {
      throw new Error(`Aggregator input did not include upstream artifact path: ${artifact.path}`);
    }
    if (!aggregatorInput.includes(artifact.relativePath)) {
      throw new Error(`Aggregator input did not include upstream relative path: ${artifact.relativePath}`);
    }
  }
  for (const expected of [
    '# Research Agent dry-run handoff',
    '# Design Agent dry-run handoff',
    'Node: agent-research',
    'Node: agent-design',
    'contentPreview',
  ]) {
    if (!aggregatorInput.includes(expected)) {
      throw new Error(`Aggregator input did not include expected upstream handoff content: ${expected}`);
    }
  }

  if (!execution.finalOutput?.includes('Aggregator Agent')) {
    throw new Error('Final output did not include downstream aggregator output.');
  }

  console.log(JSON.stringify({
    status: execution.status,
    executionId: execution.id,
    maxConcurrency: workflowDsl.execution.maxConcurrency,
    sharedWorkspacePath: execution.sharedWorkspacePath,
    artifactsPath: execution.artifactsPath,
    researchHandoffPath: researchHandoff.path,
    designHandoffPath: designHandoff.path,
    aggregatorSawResearchPath: aggregatorInput.includes(researchHandoff.path),
    aggregatorSawDesignPath: aggregatorInput.includes(designHandoff.path),
    aggregatorSawResearchPreview: aggregatorInput.includes('# Research Agent dry-run handoff'),
    aggregatorSawDesignPreview: aggregatorInput.includes('# Design Agent dry-run handoff'),
    upstreamHandoffCount: [researchHandoff, designHandoff].length,
    artifactCount: execution.artifacts.length,
    runWorkspaceExists: fs.existsSync(execution.runWorkspacePath),
    artifactsDirExists: fs.existsSync(path.join(execution.artifactsPath, 'nodes')),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
