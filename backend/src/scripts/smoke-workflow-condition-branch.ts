import fs from 'fs';
import path from 'path';
import { workflowExecutor, type WorkflowDsl } from '../services/workflow-executor.service.js';

process.env.WORKFLOW_DRY_RUN_NODE_DELAY_MS = '1';

const workflowDsl: WorkflowDsl = {
  schemaVersion: '1.0',
  name: 'Smoke Conditional Workflow Branch',
  description: 'Verifies that condition nodes activate only the selected branch and skip the other branch.',
  entryNodeId: 'node-start',
  nodes: [
    { id: 'node-start', type: 'start', label: 'Start' },
    {
      id: 'agent-evaluator',
      type: 'agent',
      label: 'Evaluator Agent',
      role: 'Check whether the plan is ready to approve.',
      kind: 'judge',
    },
    {
      id: 'node-gate',
      type: 'condition',
      label: 'Approval Gate',
      expression: 'Route to yes unless upstream output reports retry, revise, fail, failed, or no.',
    },
    {
      id: 'agent-approve',
      type: 'agent',
      label: 'Approval Agent',
      role: 'Finalize the approved plan.',
      kind: 'aggregator',
    },
    {
      id: 'agent-revise',
      type: 'agent',
      label: 'Revision Agent',
      role: 'Revise the plan if the gate rejects it.',
      kind: 'worker',
    },
    { id: 'node-end', type: 'end', label: 'End' },
  ],
  edges: [
    { id: 'edge-start-evaluator', from: 'node-start', to: 'agent-evaluator' },
    { id: 'edge-evaluator-gate', from: 'agent-evaluator', to: 'node-gate' },
    { id: 'edge-gate-approve', from: 'node-gate', to: 'agent-approve', branch: 'yes' },
    { id: 'edge-gate-revise', from: 'node-gate', to: 'agent-revise', branch: 'no' },
    { id: 'edge-approve-end', from: 'agent-approve', to: 'node-end' },
    { id: 'edge-revise-end', from: 'agent-revise', to: 'node-end' },
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
  const userId = `smoke_condition_${Date.now()}`;
  const started = await workflowExecutor.start({
    userId,
    architectureId: 'smoke-condition-branch',
    workflowDsl,
    task: 'Prepare a project plan that is ready for approval by the gate.',
    dryRun: true,
  });
  const execution = await waitForExecution(started.id, userId);

  if (execution.status !== 'succeeded') {
    throw new Error(`Expected succeeded, got ${execution.status}: ${execution.error || ''}`);
  }

  const gateState = execution.nodeStates['node-gate'];
  const approveState = execution.nodeStates['agent-approve'];
  const reviseState = execution.nodeStates['agent-revise'];
  const endState = execution.nodeStates['node-end'];
  const branchEvent = execution.events.find(
    (event) => event.type === 'branch_selected' && event.nodeId === 'node-gate'
  );

  if (gateState.output !== 'branch:yes') {
    throw new Error(`Expected condition output branch:yes, got ${gateState.output || '<empty>'}`);
  }
  if (!branchEvent || branchEvent.details?.branch !== 'yes') {
    throw new Error('Condition branch_selected event did not record the yes branch.');
  }
  if (approveState.status !== 'succeeded' || approveState.runCount !== 1) {
    throw new Error(`Approval branch did not execute exactly once: ${approveState.status}/${approveState.runCount}`);
  }
  if (reviseState.status !== 'skipped' || reviseState.runCount !== 0) {
    throw new Error(`Revision branch should be skipped without running: ${reviseState.status}/${reviseState.runCount}`);
  }
  if (endState.status !== 'succeeded') {
    throw new Error(`End node did not succeed: ${endState.status}`);
  }

  const endInput = endState.input || '';
  if (!endInput.includes('Approval Agent')) {
    throw new Error('End node did not receive the selected approval branch output.');
  }
  if (endInput.includes('Revision Agent')) {
    throw new Error('End node should not receive skipped revision branch output.');
  }
  if (!execution.finalOutput?.includes('Approval Agent')) {
    throw new Error('Final output did not include approval branch output.');
  }
  if (execution.finalOutput.includes('Revision Agent')) {
    throw new Error('Final output should not include skipped revision branch output.');
  }

  const skippedEvent = execution.events.find(
    (event) => event.type === 'node_skipped' && event.nodeId === 'agent-revise'
  );
  if (!skippedEvent) {
    throw new Error('Revision branch did not emit a node_skipped event.');
  }

  console.log(JSON.stringify({
    status: execution.status,
    executionId: execution.id,
    selectedBranch: branchEvent.details?.branch,
    gateOutput: gateState.output,
    approvalStatus: approveState.status,
    revisionStatus: reviseState.status,
    revisionRunCount: reviseState.runCount,
    endSawApproval: endInput.includes('Approval Agent'),
    endIgnoredRevision: !endInput.includes('Revision Agent'),
    finalOutputVerified: true,
    runWorkspaceExists: fs.existsSync(execution.runWorkspacePath),
    artifactsDirExists: fs.existsSync(path.join(execution.artifactsPath, 'nodes')),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
