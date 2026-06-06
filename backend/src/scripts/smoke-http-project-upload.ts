import fs from 'fs';
import path from 'path';

interface FolderFileInput {
  path: string;
  content: string;
}

interface DesktopFolderPayload {
  agentType: string;
  fileCount: number;
  totalBytes: number;
  files: FolderFileInput[];
}

const { collectFolderForUpload } = require('../../../openclaw-desktop-client/src/local-agent-scanner.cjs') as {
  collectFolderForUpload(rootPath: string): DesktopFolderPayload;
};

const API_BASE = process.env.SMOKE_API_BASE || 'http://localhost:3002';
const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

interface SmokeContext {
  token: string;
  projectId?: string;
  agentId?: string;
  tempDir: string;
}

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
    gitBranch?: string;
    gitCommit?: string;
    lastOpenedAt?: string | null;
  };
}

interface UploadPayload {
  success?: boolean;
  agentId?: string;
  workspacePath?: string;
  agentType?: string;
  fileCount?: number;
}

interface AgentPayload {
  agent?: {
    id?: string;
    name?: string;
    description?: string;
  };
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

function write(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

async function cleanup(ctx: SmokeContext) {
  if (ctx.agentId) {
    await request(`/api/agents/${encodeURIComponent(ctx.agentId)}`, {
      method: 'DELETE',
      headers: authHeaders(ctx.token),
    }).catch(() => undefined);
  }
  if (ctx.projectId) {
    await request(`/api/projects/${encodeURIComponent(ctx.projectId)}`, {
      method: 'DELETE',
      headers: authHeaders(ctx.token),
    }).catch(() => undefined);
  }
  fs.rmSync(ctx.tempDir, { recursive: true, force: true });
}

async function main() {
  const tempDir = fs.mkdtempSync(path.join(process.cwd(), 'data', 'smoke-http-'));
  const ctx: SmokeContext = { token: '', tempDir };

  try {
    const registerPayload = await request<AuthPayload>('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `smoke-${unique}@example.test`,
        username: `smoke${unique.slice(-8)}`,
        password: 'smoke-password',
      }),
    });
    ctx.token = registerPayload.accessToken;
    if (!ctx.token) throw new Error('Register response did not include accessToken.');

    const projectPayload = await request<ProjectPayload>('/api/projects', {
      method: 'POST',
      headers: authHeaders(ctx.token),
      body: JSON.stringify({
        name: `Smoke Project ${unique}`,
        description: 'Created by HTTP smoke test',
        notes: 'Verifies project CRUD and workspace metadata.',
        icon: '/project-icons/folder-blue.svg',
        teamIds: ['team-smoke-a', 'team-smoke-b'],
        ganttEnabled: true,
        ganttPlan: [{ title: 'Smoke milestone', start: '2026-06-01', end: '2026-06-05' }],
        gitRemote: 'https://example.test/openclaw/smoke.git',
        gitBranch: 'smoke-branch',
        gitCommit: 'abc1234',
      }),
    });
    const project = projectPayload.project;
    ctx.projectId = project?.id;
    if (!project || !ctx.projectId || !project.workspacePath) throw new Error('Project creation did not return id/workspacePath.');
    if (!fs.existsSync(project.workspacePath)) throw new Error(`Project workspace path does not exist: ${project.workspacePath}`);
    if (!fs.existsSync(path.join(project.workspacePath, '.openclaw-project.json'))) {
      throw new Error('Project metadata file was not created in workspace.');
    }

    const updatedPayload = await request<ProjectPayload>(`/api/projects/${encodeURIComponent(ctx.projectId)}`, {
      method: 'PATCH',
      headers: authHeaders(ctx.token),
      body: JSON.stringify({
        name: `Smoke Project Updated ${unique}`,
        gitBranch: 'updated-smoke-branch',
        gitCommit: 'updatedabc5678',
        notes: 'Updated by smoke test',
      }),
    });
    if (updatedPayload.project?.gitBranch !== 'updated-smoke-branch') {
      throw new Error('Project update did not persist gitBranch.');
    }
    if (updatedPayload.project?.gitCommit !== 'updatedabc5678') {
      throw new Error('Project update did not persist gitCommit.');
    }
    const metadataPath = path.join(project.workspacePath, '.openclaw-project.json');
    const projectMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as {
      git?: { branch?: string; commit?: string };
      gitBranch?: string;
      gitCommit?: string;
    };
    if (projectMetadata.git?.branch !== 'updated-smoke-branch' || projectMetadata.gitBranch !== 'updated-smoke-branch') {
      throw new Error('Project metadata did not persist updated gitBranch.');
    }
    if (projectMetadata.git?.commit !== 'updatedabc5678' || projectMetadata.gitCommit !== 'updatedabc5678') {
      throw new Error('Project metadata did not persist updated gitCommit.');
    }

    const openedPayload = await request<ProjectPayload>(`/api/projects/${encodeURIComponent(ctx.projectId)}/open`, {
      method: 'POST',
      headers: authHeaders(ctx.token),
    });
    if (!openedPayload.project?.lastOpenedAt) {
      throw new Error('Project open did not update lastOpenedAt.');
    }

    const localAgentDir = path.join(tempDir, 'local-openclaw-agent');
    write(path.join(localAgentDir, 'SOUL.md'), '# Smoke Soul\nUse this as the imported agent identity.');
    write(path.join(localAgentDir, 'IDENTITY.md'), '# Smoke Identity\nImported through desktop-compatible folder upload.');
    write(path.join(localAgentDir, 'agent.manifest.json'), JSON.stringify({
      schemaVersion: '1.0',
      name: `Smoke Agent ${unique}`,
      version: '1.0.0',
      description: 'Smoke imported local OpenClaw agent',
      entrypoint: { type: 'openclaw' },
      capabilities: ['chat', 'workflow'],
    }, null, 2));

    const folder = collectFolderForUpload(localAgentDir);
    if (folder.agentType !== 'openclaw') throw new Error(`Desktop scanner returned ${folder.agentType}, expected openclaw.`);
    const uploadPayload = await request<UploadPayload>('/api/upload', {
      method: 'POST',
      headers: authHeaders(ctx.token),
      body: JSON.stringify({
        uploadType: 'folder',
        name: `Smoke Imported Agent ${unique}`,
        description: 'Imported via HTTP smoke using desktop folder payload.',
        agentType: folder.agentType,
        files: folder.files,
        publishToMarket: false,
        deferMarketPublish: true,
      }),
    });
    ctx.agentId = uploadPayload.agentId;
    if (!uploadPayload.success || !ctx.agentId) throw new Error(`Upload did not create an agent: ${JSON.stringify(uploadPayload)}`);
    if (!uploadPayload.workspacePath || !fs.existsSync(uploadPayload.workspacePath)) {
      throw new Error(`Uploaded agent workspace is missing: ${uploadPayload.workspacePath}`);
    }
    if (!fs.existsSync(path.join(uploadPayload.workspacePath, 'SOUL.md'))) {
      throw new Error('Uploaded agent workspace did not contain SOUL.md.');
    }

    const agentPayload = await request<AgentPayload>(`/api/agents/${encodeURIComponent(ctx.agentId)}`, {
      headers: authHeaders(ctx.token),
    });
    if (agentPayload.agent?.id !== ctx.agentId) throw new Error('Uploaded agent could not be fetched.');
    if (!String(agentPayload.agent?.description || '').includes('Imported via HTTP smoke')) {
      throw new Error('Uploaded agent metadata description was not persisted.');
    }

    console.log(JSON.stringify({
      apiBase: API_BASE,
      userId: registerPayload.user?.id,
      projectId: ctx.projectId,
      projectWorkspacePath: project.workspacePath,
      projectOpenedAt: openedPayload.project?.lastOpenedAt,
      uploadAgentId: ctx.agentId,
      uploadAgentType: uploadPayload.agentType,
      uploadFileCount: uploadPayload.fileCount,
      uploadWorkspacePath: uploadPayload.workspacePath,
      fetchedAgentName: agentPayload.agent?.name,
    }, null, 2));
  } finally {
    await cleanup(ctx);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
