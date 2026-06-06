import fs from 'fs';
import path from 'path';
import { workflowExecutor, type WorkflowDsl } from '../services/workflow-executor.service.js';

process.env.WORKFLOW_DRY_RUN_WRITE_HANDOFF = '1';
process.env.WORKFLOW_DRY_RUN_NODE_DELAY_MS = '1';

const workflowDsl: WorkflowDsl = {
  schemaVersion: '1.0',
  name: 'Smoke Workflow Handoff',
  description: 'Verifies that upstream workspace files are exposed to downstream nodes.',
  entryNodeId: 'node-start',
  nodes: [
    { id: 'node-start', type: 'start', label: 'Start' },
    {
      id: 'agent-writer',
      type: 'agent',
      label: 'Writer Agent',
      role: 'Create a handoff file for the downstream reviewer.',
      kind: 'worker',
    },
    {
      id: 'agent-reviewer',
      type: 'agent',
      label: 'Reviewer Agent',
      role: 'Read upstream handoff files before responding.',
      kind: 'evaluator',
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

async function main() {
  const userId = `smoke_${Date.now()}`;
  const started = await workflowExecutor.start({
    userId,
    architectureId: 'smoke-handoff',
    workflowDsl,
    task: 'Create a short project brief, save it as a file, then review it downstream.',
    dryRun: true,
  });
  const execution = await waitForExecution(started.id, userId);

  if (execution.status !== 'succeeded') {
    throw new Error(`Expected succeeded, got ${execution.status}: ${execution.error || ''}`);
  }

  const writerState = execution.nodeStates['agent-writer'];
  const reviewerState = execution.nodeStates['agent-reviewer'];
  const workspaceArtifacts = writerState.artifacts?.filter((artifact) => artifact.kind === 'workspace-file') ?? [];
  const handoffArtifact = workspaceArtifacts.find((artifact) => artifact.relativePath.startsWith('handoff/'));

  if (!handoffArtifact) {
    throw new Error('Writer node did not record a handoff workspace-file artifact.');
  }
  if (!fs.existsSync(handoffArtifact.path)) {
    throw new Error(`Handoff artifact file does not exist: ${handoffArtifact.path}`);
  }
  const handoffContent = fs.readFileSync(handoffArtifact.path, 'utf-8');
  for (const expected of [
    '# Writer Agent dry-run handoff',
    `Workflow: ${workflowDsl.name}`,
    `Execution: ${execution.id}`,
    'Node: agent-writer',
    'Create a short project brief',
  ]) {
    if (!handoffContent.includes(expected)) {
      throw new Error(`Handoff file did not include expected content: ${expected}`);
    }
  }
  if (!reviewerState.input?.includes(handoffArtifact.path)) {
    throw new Error('Reviewer input did not include the upstream handoff artifact path.');
  }
  if (!reviewerState.input.includes('### Handoff files') || !reviewerState.input.includes(handoffArtifact.relativePath)) {
    throw new Error('Reviewer input did not include formatted handoff artifact metadata.');
  }
  if (!reviewerState.input.includes('contentPreview') || !reviewerState.input.includes('# Writer Agent dry-run handoff')) {
    throw new Error('Reviewer input did not include upstream handoff file content preview.');
  }
  if (!execution.finalOutput?.includes('Reviewer Agent')) {
    throw new Error('Final output did not include downstream reviewer output.');
  }

  console.log(JSON.stringify({
    status: execution.status,
    executionId: execution.id,
    sharedWorkspacePath: execution.sharedWorkspacePath,
    artifactsPath: execution.artifactsPath,
    artifactCount: execution.artifacts.length,
    handoffPath: handoffArtifact.path,
    handoffRelativePath: handoffArtifact.relativePath,
    reviewerSawHandoff: reviewerState.input.includes(handoffArtifact.path),
    reviewerSawFormattedHandoff: reviewerState.input.includes('### Handoff files'),
    reviewerSawHandoffContentPreview: reviewerState.input.includes('# Writer Agent dry-run handoff'),
    handoffContentVerified: true,
    handoffFileSize: fs.statSync(handoffArtifact.path).size,
    nodeOutputExists: Boolean(writerState.outputFilePath && fs.existsSync(writerState.outputFilePath)),
    runWorkspaceExists: fs.existsSync(execution.runWorkspacePath),
    artifactsDirExists: fs.existsSync(path.join(execution.artifactsPath, 'nodes')),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
