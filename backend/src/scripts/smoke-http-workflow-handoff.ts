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
  status?: string;
  error?: string;
  output?: string;
  artifacts?: WorkflowArtifactPayload[];
}

interface WorkflowExecutionPayload {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  error?: string;
  projectId?: string;
  sharedWorkspacePath?: string;
  runWorkspacePath?: string;
  nodeStates?: Record<string, WorkflowNodeStatePayload>;
  finalOutput?: string;
  artifacts?: WorkflowArtifactPayload[];
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
      name: 'HTTP Workflow Real Failure Smoke',
      description: 'Verifies /api/workflows/execute fails when a non-dry-run node has no real agent.',
      entryNodeId: 'node-start',
      nodes: [
        { id: 'node-start', type: 'start', label: 'Start' },
        {
          id: 'agent-writer',
          type: 'agent',
          label: 'HTTP Writer',
          role: 'Write a real project deliverable.',
          kind: 'worker',
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
        timeoutSec: 60,
      },
    };

    const startPayload = await request<WorkflowPayload>('/api/workflows/execute', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        workflowDsl,
        task: 'Create a real project deliverable. This must fail if no executable agent is bound.',
        architectureId: 'http-smoke-workflow-real-failure',
        projectId,
        dryRun: false,
      }),
    });
    const started = startPayload.execution;
    if (!started?.id) throw new Error(`Workflow start did not return an execution id: ${JSON.stringify(startPayload)}`);

    const execution = await waitForExecution(token, started.id);
    const writerState = execution.nodeStates?.['agent-writer'];
    const error = writerState?.error || execution.error || '';

    if (execution.status !== 'failed') {
      throw new Error(`Expected failed, got ${execution.status}: ${execution.finalOutput || ''}`);
    }
    if (execution.projectId !== projectId) {
      throw new Error(`Execution did not keep projectId. Expected ${projectId}, got ${execution.projectId}`);
    }
    if (!/未绑定可执行 Agent/.test(error)) {
      throw new Error(`Expected unbound-agent failure, got: ${error}`);
    }
    if (writerState?.output || writerState?.artifacts?.some((artifact) => artifact.kind === 'workspace-file')) {
      throw new Error('HTTP workflow produced fallback output or workspace artifacts for an unbound real run.');
    }

    console.log(JSON.stringify({
      apiBase: API_BASE,
      userId: registerPayload.user?.id,
      projectId,
      executionId: execution.id,
      status: execution.status,
      sharedWorkspacePath: execution.sharedWorkspacePath,
      runWorkspacePath: execution.runWorkspacePath,
      fallbackSuccessPrevented: true,
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
