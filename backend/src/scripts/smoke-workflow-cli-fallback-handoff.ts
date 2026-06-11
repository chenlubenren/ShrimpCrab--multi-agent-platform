import { getRawDb } from '../db/index.js';
import { createUser } from '../services/auth.service.js';
import { workflowExecutor, type WorkflowDsl } from '../services/workflow-executor.service.js';

process.env.WORKFLOW_DRY_RUN_NODE_DELAY_MS = '1';

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

function buildWorkflow(agentInstanceId?: string): WorkflowDsl {
  return {
    schemaVersion: '1.0',
    name: 'Smoke Real Workflow Failure',
    description: 'Verifies non-dry-run workflows fail instead of returning fallback handoff output.',
    entryNodeId: 'node-start',
    nodes: [
      { id: 'node-start', type: 'start', label: 'Start' },
      {
        id: 'agent-writer',
        type: 'agent',
        label: 'Real Writer',
        role: 'Must be a real executable agent.',
        kind: 'worker',
        ...(agentInstanceId ? { agentInstanceId } : {}),
      },
      { id: 'node-end', type: 'end', label: 'End' },
    ],
    edges: [
      { id: 'edge-start-writer', from: 'node-start', to: 'agent-writer' },
      { id: 'edge-writer-end', from: 'agent-writer', to: 'node-end' },
    ],
    execution: {
      mode: 'dag',
      maxConcurrency: 1,
      timeoutSec: 3,
    },
  };
}

async function assertWorkflowFails(userId: string, workflowDsl: WorkflowDsl, expectedError: RegExp) {
  const started = await workflowExecutor.start({
    userId,
    architectureId: 'smoke-real-workflow-failure',
    workflowDsl,
    task: 'Create a real deliverable. This must not be faked.',
    dryRun: false,
  });
  const execution = await waitForExecution(started.id, userId);

  if (execution.status !== 'failed') {
    throw new Error(`Expected failed, got ${execution.status}: ${execution.finalOutput || ''}`);
  }

  const writerState = execution.nodeStates['agent-writer'];
  if (writerState.status !== 'failed') {
    throw new Error(`Expected writer node to fail, got ${writerState.status}`);
  }
  if (!expectedError.test(writerState.error || execution.error || '')) {
    throw new Error(`Unexpected failure message: ${writerState.error || execution.error || ''}`);
  }
  if (writerState.output || writerState.artifacts?.some((artifact) => artifact.kind === 'workspace-file')) {
    throw new Error('Failed real workflow produced fallback output or workspace artifacts.');
  }

  return execution;
}

async function main() {
  const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const user = await createUser({
    email: `smoke-workflow-real-failure-${unique}@example.test`,
    username: `smokewrf${unique.slice(-8)}`,
    password: 'smoke-password',
  });
  const userId = user.id;

  try {
    const unbound = await assertWorkflowFails(
      userId,
      buildWorkflow(),
      /未绑定可执行 Agent/
    );
    const missing = await assertWorkflowFails(
      userId,
      buildWorkflow(`missing-agent-${unique}`),
      /不存在或当前用户无权限/
    );

    console.log(JSON.stringify({
      unboundExecutionId: unbound.id,
      missingExecutionId: missing.id,
      unboundStatus: unbound.status,
      missingStatus: missing.status,
      fallbackSuccessPrevented: true,
    }, null, 2));
  } finally {
    getRawDb().prepare('DELETE FROM users WHERE id = ?').run(userId);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
