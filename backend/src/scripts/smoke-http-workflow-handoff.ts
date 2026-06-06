import fs from 'fs';
import path from 'path';

const API_BASE = process.env.SMOKE_API_BASE || 'http://localhost:3002';
const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

interface AuthPayload {
  accessToken: string;
  user?: {
    id?: string;
  };
}

interface ProjectPayload {
  project?: {
    id?: string;
    workspacePath?: string;
  };
}

interface WorkflowArtifactPayload {
  kind?: string;
  path?: string;
  relativePath?: string;
}

interface WorkflowNodeStatePayload {
  input?: string;
  artifacts?: WorkflowArtifactPayload[];
}

interface WorkflowExecutionPayload {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  error?: string;
  projectId?: string;
  projectWorkspacePath?: string;
  sharedWorkspacePath?: string;
  runWorkspacePath?: string;
  nodeStates?: Record<string, WorkflowNodeStatePayload>;
  finalOutput?: string;
}

interface WorkflowPayload {
  execution?: WorkflowExecutionPayload;
}

async function request<T>(pathname: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${pathname}`, options);
  const payload = await response.json().catch(() => ({})) as T;
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${pathname} failed: HTTP ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForExecution(token: string, executionId: string): Promise<WorkflowExecutionPayload> {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const payload = await request<WorkflowPayload>(`/api/workflows/executions/${encodeURIComponent(executionId)}`, {
      headers: authHeaders(token),
    });
    if (!payload.execution) throw new Error(`Execution payload missing for ${executionId}`);
    if (!['queued', 'running'].includes(payload.execution.status)) return payload.execution;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for workflow execution ${executionId}`);
}

async function main() {
  let token = '';
  let projectId = '';

  try {
    const registerPayload = await request<AuthPayload>('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `workflow-smoke-${unique}@example.test`,
        username: `wf${unique.slice(-10)}`,
        password: 'smoke-password',
      }),
    });
    token = registerPayload.accessToken;
    if (!token) throw new Error('Register response did not include accessToken.');

    const projectPayload = await request<ProjectPayload>('/api/projects', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        name: `Workflow HTTP Smoke Project ${unique}`,
        description: 'Project-bound HTTP workflow smoke test.',
        icon: '/project-icons/folder-blue.svg',
        teamIds: ['workflow-http-smoke'],
        gitBranch: 'main',
      }),
    });
    const project = projectPayload.project;
    projectId = project?.id || '';
    if (!projectId || !project?.workspacePath) {
      throw new Error(`Project creation did not return id/workspacePath: ${JSON.stringify(projectPayload)}`);
    }

    const workflowDsl = {
      schemaVersion: '1.0',
      name: 'HTTP Workflow Handoff Smoke',
      description: 'Verifies /api/workflows/execute exposes upstream workspace files to downstream nodes.',
      entryNodeId: 'node-start',
      nodes: [
        { id: 'node-start', type: 'start', label: 'Start' },
        {
          id: 'agent-writer',
          type: 'agent',
          label: 'HTTP Writer',
          agentInstanceId: `missing-writer-${unique}`,
          role: 'Write a handoff file for the downstream reviewer.',
          kind: 'worker',
        },
        {
          id: 'agent-reviewer',
          type: 'agent',
          label: 'HTTP Reviewer',
          agentInstanceId: `missing-reviewer-${unique}`,
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

    const startPayload = await request<WorkflowPayload>('/api/workflows/execute', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        workflowDsl,
        task: 'Create a project handoff file, then have the reviewer consume it through the HTTP workflow API.',
        architectureId: 'http-smoke-workflow-handoff',
        projectId,
        dryRun: false,
      }),
    });
    const started = startPayload.execution;
    if (!started?.id) throw new Error(`Workflow start did not return an execution id: ${JSON.stringify(startPayload)}`);

    const execution = await waitForExecution(token, started.id);
    if (execution.status !== 'succeeded') {
      throw new Error(`Expected succeeded, got ${execution.status}: ${execution.error || ''}`);
    }
    if (execution.projectId !== projectId) {
      throw new Error(`Execution did not keep projectId. Expected ${projectId}, got ${execution.projectId}`);
    }
    if (execution.sharedWorkspacePath !== project.workspacePath) {
      throw new Error(`Expected shared workspace to be project workspace: ${execution.sharedWorkspacePath}`);
    }
    if (!execution.runWorkspacePath?.startsWith(path.join(project.workspacePath, '.openclaw', 'workflow-runs'))) {
      throw new Error(`Run workspace is not under project .openclaw/workflow-runs: ${execution.runWorkspacePath}`);
    }

    const writerState = execution.nodeStates?.['agent-writer'];
    const reviewerState = execution.nodeStates?.['agent-reviewer'];
    const handoffArtifact = writerState?.artifacts?.find(
      (artifact) => artifact.kind === 'workspace-file' && artifact.relativePath?.startsWith('handoff/')
    );
    if (!handoffArtifact?.path || !handoffArtifact.relativePath) {
      throw new Error('Writer did not record a workspace handoff artifact.');
    }
    if (!fs.existsSync(handoffArtifact.path)) {
      throw new Error(`Handoff artifact file does not exist: ${handoffArtifact.path}`);
    }
    const handoffContent = fs.readFileSync(handoffArtifact.path, 'utf-8');
    if (!handoffContent.includes('unbound-agent fallback handoff') || !handoffContent.includes('agent-writer')) {
      throw new Error('HTTP workflow handoff file did not include expected fallback content.');
    }
    if (!reviewerState?.input?.includes(handoffArtifact.path) || !reviewerState.input.includes('### Handoff files')) {
      throw new Error('Reviewer input did not include formatted upstream handoff metadata.');
    }
    if (!reviewerState.input.includes('contentPreview') || !reviewerState.input.includes('unbound-agent fallback handoff')) {
      throw new Error('Reviewer input did not include upstream handoff file content preview.');
    }
    if (!execution.finalOutput?.includes('HTTP Reviewer')) {
      throw new Error('Final output did not include downstream reviewer output.');
    }

    console.log(JSON.stringify({
      apiBase: API_BASE,
      userId: registerPayload.user?.id,
      projectId,
      executionId: execution.id,
      status: execution.status,
      sharedWorkspacePath: execution.sharedWorkspacePath,
      runWorkspacePath: execution.runWorkspacePath,
      handoffPath: handoffArtifact.path,
      handoffRelativePath: handoffArtifact.relativePath,
      reviewerSawHandoff: reviewerState.input.includes(handoffArtifact.path),
      reviewerSawFormattedHandoff: reviewerState.input.includes('### Handoff files'),
      reviewerSawHandoffContentPreview: reviewerState.input.includes('unbound-agent fallback handoff'),
    }, null, 2));
  } finally {
    if (token && projectId) {
      await request(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      }).catch(() => undefined);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
