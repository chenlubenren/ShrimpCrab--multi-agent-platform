import fs from 'fs';
import path from 'path';
import { getRawDb } from '../db/index.js';
import { createUser } from '../services/auth.service.js';
import { createProject, deleteProject } from '../services/project.service.js';
import { workflowExecutor, type WorkflowDsl } from '../services/workflow-executor.service.js';

process.env.WORKFLOW_DRY_RUN_WRITE_HANDOFF = '1';
process.env.WORKFLOW_DRY_RUN_NODE_DELAY_MS = '1';

const workflowDsl: WorkflowDsl = {
  schemaVersion: '1.0',
  name: 'Smoke Project Workflow Handoff',
  description: 'Verifies that a project-bound workflow shares project workspace files across nodes.',
  entryNodeId: 'node-start',
  nodes: [
    { id: 'node-start', type: 'start', label: 'Start' },
    {
      id: 'agent-writer',
      type: 'agent',
      label: 'Project Writer',
      role: 'Create a handoff file in the shared project workspace.',
      kind: 'worker',
    },
    {
      id: 'agent-reviewer',
      type: 'agent',
      label: 'Project Reviewer',
      role: 'Read upstream project handoff files before responding.',
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

function assertInside(parent: string, child: string, label: string): void {
  const relative = path.relative(parent, child);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} is outside expected project workspace: ${child}`);
  }
}

async function main() {
  const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const user = await createUser({
    email: `smoke-project-workflow-${unique}@example.test`,
    username: `smokepwf${unique.slice(-8)}`,
    password: 'smoke-password',
  });
  const userId = user.id;
  const project = await createProject(userId, {
    name: `Smoke Workflow Project ${Date.now()}`,
    description: 'Project-bound workflow smoke test.',
    notes: 'Verifies shared workspace file handoff.',
    icon: '/project-icons/folder-blue.svg',
    teamIds: ['smoke-project-team'],
    ganttEnabled: true,
    ganttPlan: [{ title: 'Smoke handoff', start: '2026-06-01', end: '2026-06-05' }],
    gitRemote: 'https://example.test/openclaw/project-workflow-smoke.git',
    gitBranch: 'smoke-project-workflow',
    gitCommit: 'smoke',
  });

  if (!project?.id || !project.workspacePath) {
    throw new Error('Project creation did not return id/workspacePath.');
  }

  try {
    const preexistingHandoffPath = path.join(project.workspacePath, 'handoff', 'agent-writer-run-1.md');
    fs.mkdirSync(path.dirname(preexistingHandoffPath), { recursive: true });
    fs.writeFileSync(preexistingHandoffPath, 'preexisting handoff placeholder', 'utf-8');

    const started = await workflowExecutor.start({
      userId,
      projectId: project.id,
      architectureId: 'smoke-project-handoff',
      workflowDsl,
      task: 'Create a project handoff file, then review it downstream.',
      dryRun: true,
    });
    const execution = await waitForExecution(started.id, userId);

    if (execution.status !== 'succeeded') {
      throw new Error(`Expected succeeded, got ${execution.status}: ${execution.error || ''}`);
    }

    if (execution.projectId !== project.id) {
      throw new Error(`Execution projectId mismatch: ${execution.projectId} !== ${project.id}`);
    }
    if (execution.sharedWorkspacePath !== project.workspacePath) {
      throw new Error(`Expected shared workspace to be project workspace: ${execution.sharedWorkspacePath}`);
    }
    if (!execution.runWorkspacePath.startsWith(path.join(project.workspacePath, '.openclaw', 'workflow-runs'))) {
      throw new Error(`Run workspace is not under project .openclaw/workflow-runs: ${execution.runWorkspacePath}`);
    }

    const writerState = execution.nodeStates['agent-writer'];
    const reviewerState = execution.nodeStates['agent-reviewer'];
    const workspaceArtifacts = writerState.artifacts?.filter((artifact) => artifact.kind === 'workspace-file') ?? [];
    const handoffArtifact = workspaceArtifacts.find((artifact) => artifact.relativePath.startsWith('handoff/'));

    if (!handoffArtifact) {
      throw new Error('Writer node did not record a project handoff workspace-file artifact.');
    }
    if (!fs.existsSync(handoffArtifact.path)) {
      throw new Error(`Project handoff artifact file does not exist: ${handoffArtifact.path}`);
    }
    assertInside(project.workspacePath, handoffArtifact.path, 'Handoff artifact');
    if (handoffArtifact.path !== preexistingHandoffPath) {
      throw new Error(`Expected writer to update preexisting handoff path: ${handoffArtifact.path}`);
    }
    if (!handoffArtifact.label.includes('updated')) {
      throw new Error(`Existing handoff file was not recorded as an updated workspace artifact: ${handoffArtifact.label}`);
    }
    const handoffContent = fs.readFileSync(handoffArtifact.path, 'utf-8');
    for (const expected of [
      '# Project Writer dry-run handoff',
      `Workflow: ${workflowDsl.name}`,
      `Execution: ${execution.id}`,
      'Node: agent-writer',
      'Create a project handoff file',
    ]) {
      if (!handoffContent.includes(expected)) {
        throw new Error(`Project handoff file did not include expected content: ${expected}`);
      }
    }
    if (!reviewerState.input?.includes(handoffArtifact.path)) {
      throw new Error('Reviewer input did not include the upstream project handoff artifact path.');
    }
    if (!reviewerState.input.includes('### Handoff files') || !reviewerState.input.includes(handoffArtifact.relativePath)) {
      throw new Error('Reviewer input did not include formatted project handoff artifact metadata.');
    }
    if (!reviewerState.input.includes('contentPreview') || !reviewerState.input.includes('# Project Writer dry-run handoff')) {
      throw new Error('Reviewer input did not include upstream project handoff file content preview.');
    }
    if (!execution.finalOutput?.includes('Project Reviewer')) {
      throw new Error('Final output did not include downstream project reviewer output.');
    }

    console.log(JSON.stringify({
      status: execution.status,
      executionId: execution.id,
      projectId: project.id,
      projectWorkspacePath: project.workspacePath,
      sharedWorkspacePath: execution.sharedWorkspacePath,
      runWorkspacePath: execution.runWorkspacePath,
      artifactsPath: execution.artifactsPath,
      artifactCount: execution.artifacts.length,
      handoffPath: handoffArtifact.path,
      handoffRelativePath: handoffArtifact.relativePath,
      preexistingHandoffUpdated: handoffArtifact.label.includes('updated'),
      reviewerSawHandoff: reviewerState.input.includes(handoffArtifact.path),
      reviewerSawFormattedHandoff: reviewerState.input.includes('### Handoff files'),
      reviewerSawHandoffContentPreview: reviewerState.input.includes('# Project Writer dry-run handoff'),
      handoffContentVerified: true,
      handoffInsideProjectWorkspace: true,
      runWorkspaceInsideProjectWorkspace: true,
    }, null, 2));
  } finally {
    await deleteProject(userId, project.id).catch(() => undefined);
    if (path.basename(project.workspacePath) === 'workspace') {
      const projectRoot = path.dirname(project.workspacePath);
      if (path.basename(projectRoot) === project.id) {
        fs.rmSync(projectRoot, { recursive: true, force: true });
      }
    }
    getRawDb().prepare('DELETE FROM users WHERE id = ?').run(userId);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
