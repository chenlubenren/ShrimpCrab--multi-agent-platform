import fs from 'fs';
import { getRawDb } from '../db/index.js';
import { createUser } from '../services/auth.service.js';
import { createAgent, deleteAgent } from '../services/agent.service.js';
import { workflowExecutor, type WorkflowDsl } from '../services/workflow-executor.service.js';

process.env.WORKFLOW_DRY_RUN_NODE_DELAY_MS = '1';

const unavailablePlatform = process.env.SMOKE_WORKFLOW_FALLBACK_PLATFORM || 'claude-code';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForExecution(id: string, userId: string) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const execution = workflowExecutor.get(id, userId);
    if (!execution) throw new Error(`Execution disappeared: ${id}`);
    if (!['queued', 'running'].includes(execution.status)) return execution;
    await sleep(25);
  }
  throw new Error(`Timed out waiting for execution ${id}`);
}

async function main() {
  const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const user = await createUser({
    email: `smoke-workflow-fallback-${unique}@example.test`,
    username: `smokewff${unique.slice(-8)}`,
    password: 'smoke-password',
  });
  const userId = user.id;
  const createdAgentIds: string[] = [];

  try {
    const writer = await createAgent(userId, {
      name: `Fallback Writer ${unique}`,
      description: 'Smoke writer that intentionally falls back when CLI is unavailable.',
      manifest: {
        schemaVersion: '1.0',
        name: 'Fallback Writer',
        entrypoint: { type: unavailablePlatform },
        capabilities: ['workflow'],
      },
    });
    const reviewer = await createAgent(userId, {
      name: `Fallback Reviewer ${unique}`,
      description: 'Smoke reviewer that consumes fallback handoff files.',
      manifest: {
        schemaVersion: '1.0',
        name: 'Fallback Reviewer',
        entrypoint: { type: unavailablePlatform },
        capabilities: ['workflow'],
      },
    });
    createdAgentIds.push(writer.id, reviewer.id);

    const workflowDsl: WorkflowDsl = {
      schemaVersion: '1.0',
      name: 'Smoke CLI Fallback Workflow Handoff',
      description: 'Verifies non-dry-run CLI fallback still writes handoff files.',
      entryNodeId: 'node-start',
      nodes: [
        { id: 'node-start', type: 'start', label: 'Start' },
        {
          id: 'agent-writer',
          type: 'agent',
          label: 'CLI Fallback Writer',
          role: 'Create a handoff file even when CLI is unavailable.',
          kind: 'worker',
          agentInstanceId: writer.id,
        },
        {
          id: 'agent-reviewer',
          type: 'agent',
          label: 'CLI Fallback Reviewer',
          role: 'Read upstream fallback handoff files before responding.',
          kind: 'evaluator',
          agentInstanceId: reviewer.id,
        },
        { id: 'node-end', type: 'end', label: 'End' },
      ],
      edges: [
        { id: 'edge-start-writer', from: 'node-start', to: 'agent-writer' },
        { id: 'edge-writer-reviewer', from: 'agent-writer', to: 'agent-reviewer' },
        { id: 'edge-reviewer-end', from: 'agent-reviewer', to: 'node-end' },
      ],
      execution: {
        mode: 'dag',
        maxConcurrency: 1,
        timeoutSec: 3,
      },
    };

    const started = await workflowExecutor.start({
      userId,
      architectureId: 'smoke-cli-fallback-handoff',
      workflowDsl,
      task: 'Write a fallback handoff file and make the reviewer consume it.',
      dryRun: false,
    });
    const execution = await waitForExecution(started.id, userId);

    if (execution.status !== 'succeeded') {
      throw new Error(`Expected succeeded, got ${execution.status}: ${execution.error || ''}`);
    }

    const writerState = execution.nodeStates['agent-writer'];
    const reviewerState = execution.nodeStates['agent-reviewer'];
    if (!writerState.output?.includes('CLI unavailable fallback completed')) {
      throw new Error('Writer did not use CLI unavailable fallback path.');
    }
    const handoffArtifact = writerState.artifacts?.find(
      (artifact) => artifact.kind === 'workspace-file' && artifact.relativePath.startsWith('handoff/')
    );
    if (!handoffArtifact) {
      throw new Error('Writer fallback did not record a handoff workspace-file artifact.');
    }
    if (!fs.existsSync(handoffArtifact.path)) {
      throw new Error(`Fallback handoff file does not exist: ${handoffArtifact.path}`);
    }
    const handoffContent = fs.readFileSync(handoffArtifact.path, 'utf-8');
    if (!handoffContent.includes('CLI unavailable fallback handoff')) {
      throw new Error('Fallback handoff file did not include fallback heading.');
    }
    if (!reviewerState.input?.includes(handoffArtifact.path) || !reviewerState.input.includes('### Handoff files')) {
      throw new Error('Reviewer input did not include formatted fallback handoff artifact metadata.');
    }
    if (!reviewerState.input.includes('contentPreview') || !reviewerState.input.includes('CLI unavailable fallback handoff')) {
      throw new Error('Reviewer input did not include fallback handoff file content preview.');
    }
    if (!execution.finalOutput?.includes('CLI Fallback Reviewer')) {
      throw new Error('Final output did not include fallback reviewer output.');
    }

    console.log(JSON.stringify({
      status: execution.status,
      executionId: execution.id,
      platform: unavailablePlatform,
      writerAgentId: writer.id,
      reviewerAgentId: reviewer.id,
      handoffPath: handoffArtifact.path,
      handoffRelativePath: handoffArtifact.relativePath,
      reviewerSawFallbackHandoff: true,
      reviewerSawFallbackHandoffContentPreview: reviewerState.input.includes('CLI unavailable fallback handoff'),
      cliFallbackHandoffVerified: true,
    }, null, 2));
  } finally {
    for (const agentId of createdAgentIds) {
      await deleteAgent(agentId, userId).catch(() => undefined);
    }
    getRawDb().prepare('DELETE FROM users WHERE id = ?').run(userId);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
