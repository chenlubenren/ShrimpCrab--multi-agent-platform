import fs from 'fs';
import path from 'path';
import { getRawDb } from '../db/index.js';
import { createUser } from '../services/auth.service.js';
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  touchProject,
  updateProject,
} from '../services/project.service.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const user = await createUser({
    email: `smoke-project-crud-${unique}@example.test`,
    username: `smokeproj${unique.slice(-8)}`,
    password: 'smoke-password',
  });
  const userId = user.id;
  const createdProjectRoots: string[] = [];
  const createdProjectIds: string[] = [];

  try {
    const first = await createProject(userId, {
      name: `Smoke Project A ${unique}`,
      description: 'Project CRUD smoke A.',
      notes: 'Verifies project field persistence.',
      icon: '/project-icons/folder-purple.svg',
      teamIds: ['team-a', 'team-b'],
      ganttEnabled: true,
      ganttPlan: [{
        id: 'phase-a',
        title: 'Phase A',
        start: '2026-06-01',
        end: '2026-06-05',
        ownerTeamId: 'team-a',
        status: 'active',
      }],
      gitRemote: 'https://example.test/openclaw/project-a.git',
      gitBranch: 'feature/project-a',
      gitCommit: 'abc123',
    });
    const second = await createProject(userId, {
      name: `Smoke Project B ${unique}`,
      description: 'Project CRUD smoke B.',
      notes: '',
      icon: '/project-icons/folder-green.svg',
      teamIds: ['team-c'],
      ganttEnabled: false,
      ganttPlan: [],
      gitRemote: '',
      gitBranch: 'main',
      gitCommit: '',
    });

    assert(first?.id && first.workspacePath, 'First project did not return id/workspacePath.');
    assert(second?.id && second.workspacePath, 'Second project did not return id/workspacePath.');
    createdProjectIds.push(first.id, second.id);
    createdProjectRoots.push(path.dirname(first.workspacePath), path.dirname(second.workspacePath));

    assert(fs.existsSync(first.workspacePath), `First project workspace missing: ${first.workspacePath}`);
    const metadataPath = path.join(first.workspacePath, '.openclaw-project.json');
    assert(fs.existsSync(metadataPath), 'Project metadata file was not created.');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as {
      id?: string;
      name?: string;
      icon?: string;
      teamIds?: string[];
      ganttEnabled?: boolean;
      ganttPlan?: Array<{ title?: string; ownerTeamId?: string; status?: string }>;
      git?: { branch?: string; commit?: string; remote?: string };
    };
    assert(metadata.id === first.id, 'Project metadata id mismatch.');
    assert(metadata.name === first.name, 'Project metadata name mismatch.');
    assert(metadata.icon === '/project-icons/folder-purple.svg', 'Project metadata icon mismatch.');
    assert(Array.isArray(metadata.teamIds) && metadata.teamIds.length === 2, 'Project metadata teamIds mismatch.');
    assert(metadata.ganttEnabled === true, 'Project metadata ganttEnabled mismatch.');
    assert(metadata.ganttPlan?.[0]?.ownerTeamId === 'team-a', 'Project metadata gantt ownerTeamId mismatch.');
    assert(metadata.ganttPlan?.[0]?.status === 'active', 'Project metadata gantt status mismatch.');
    assert(metadata.git?.branch === 'feature/project-a', 'Project metadata git branch mismatch.');

    const fetched = await getProject(userId, first.id);
    assert(fetched?.teamIds.length === 2, 'Fetched project teamIds were not parsed.');
    assert(fetched.ganttEnabled === true, 'Fetched project ganttEnabled mismatch.');
    assert(Array.isArray(fetched.ganttPlan) && fetched.ganttPlan.length === 1, 'Fetched project ganttPlan mismatch.');
    assert((fetched.ganttPlan[0] as any).ownerTeamId === 'team-a', 'Fetched project gantt ownerTeamId mismatch.');
    assert((fetched.ganttPlan[0] as any).status === 'active', 'Fetched project gantt status mismatch.');

    await new Promise((resolve) => setTimeout(resolve, 5));
    const touchedFirst = await touchProject(userId, first.id);
    assert(touchedFirst?.lastOpenedAt, 'touchProject did not set lastOpenedAt.');
    const listedAfterTouch = await listProjects(userId);
    assert(listedAfterTouch[0]?.id === first.id, 'Touched project did not become most recent.');

    const updated = await updateProject(userId, first.id, {
      name: `Smoke Project A Updated ${unique}`,
      notes: 'Updated notes.',
      icon: '/project-icons/folder-red.svg',
      teamIds: ['team-a'],
      ganttEnabled: true,
      ganttPlan: [{
        id: 'phase-release',
        title: 'Release phase',
        start: '2026-06-06',
        end: '2026-06-09',
        ownerTeamId: 'team-a',
        status: 'done',
      }],
      gitBranch: 'release/project-a',
      gitCommit: 'def456',
    });
    assert(updated?.name.includes('Updated'), 'Project update did not persist name.');
    assert(updated?.icon === '/project-icons/folder-red.svg', 'Project update did not persist icon.');
    assert(updated?.teamIds.length === 1, 'Project update did not persist teamIds.');
    assert(updated?.ganttEnabled === true, 'Project update did not persist ganttEnabled.');
    assert((updated?.ganttPlan[0] as any)?.status === 'done', 'Project update did not persist gantt status.');
    assert(updated?.gitBranch === 'release/project-a', 'Project update did not persist gitBranch.');
    assert(updated?.gitCommit === 'def456', 'Project update did not persist gitCommit.');

    const updatedMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as {
      name?: string;
      icon?: string;
      teamIds?: string[];
      ganttPlan?: Array<{ status?: string; ownerTeamId?: string }>;
      gitBranch?: string;
      gitCommit?: string;
    };
    assert(updatedMetadata.name === updated.name, 'Updated metadata name mismatch.');
    assert(updatedMetadata.icon === '/project-icons/folder-red.svg', 'Updated metadata icon mismatch.');
    assert(Array.isArray(updatedMetadata.teamIds) && updatedMetadata.teamIds.length === 1, 'Updated metadata teamIds mismatch.');
    assert(updatedMetadata.ganttPlan?.[0]?.status === 'done', 'Updated metadata gantt status mismatch.');
    assert(updatedMetadata.ganttPlan?.[0]?.ownerTeamId === 'team-a', 'Updated metadata gantt ownerTeamId mismatch.');
    assert(updatedMetadata.gitBranch === 'release/project-a', 'Updated metadata gitBranch mismatch.');

    assert(await deleteProject(userId, second.id), 'deleteProject returned false for existing project.');
    createdProjectIds.splice(createdProjectIds.indexOf(second.id), 1);
    assert(!(await getProject(userId, second.id)), 'Deleted project could still be fetched.');

    console.log(JSON.stringify({
      userId,
      createdProjectId: first.id,
      updatedProjectName: updated.name,
      projectWorkspacePath: first.workspacePath,
      metadataPath,
      mostRecentProjectId: listedAfterTouch[0]?.id,
      deletedProjectId: second.id,
      projectCrudVerified: true,
    }, null, 2));
  } finally {
    for (const projectId of createdProjectIds) {
      await deleteProject(userId, projectId).catch(() => undefined);
    }
    for (const projectRoot of createdProjectRoots) {
      if (path.basename(projectRoot).length >= 16) {
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
