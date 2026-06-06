import fs from 'fs';
import path from 'path';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { projects, type Project } from '../db/schema.js';
import { getProjectWorkspacePath, writeFile } from './workspace.service.js';

const DEFAULT_PROJECT_ICON = '/project-icons/folder-blue.svg';

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeIcon(value: unknown): string {
  const icon = normalizeText(value);
  return icon || DEFAULT_PROJECT_ICON;
}

function normalizeJsonArray(value: unknown): string {
  if (!Array.isArray(value)) return '[]';
  return JSON.stringify(value);
}

function safeProject(project: Project) {
  return {
    id: project.id,
    userId: project.userId,
    name: project.name,
    description: project.description,
    notes: project.notes,
    icon: project.icon,
    workspacePath: project.workspacePath,
    teamIds: parseJsonArray(project.teamIds),
    ganttEnabled: Boolean(project.ganttEnabled),
    ganttPlan: parseJsonArray(project.ganttPlan),
    gitRemote: project.gitRemote,
    gitBranch: project.gitBranch,
    gitCommit: project.gitCommit,
    status: project.status,
    lastOpenedAt: project.lastOpenedAt?.toISOString?.() ?? null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

type SafeProject = ReturnType<typeof safeProject>;

function writeProjectMetadata(project: SafeProject): void {
  writeFile(
    path.join(project.workspacePath, '.openclaw-project.json'),
    JSON.stringify(
      {
        ...project,
        git: {
          remote: project.gitRemote,
          branch: project.gitBranch,
          commit: project.gitCommit,
        },
      },
      null,
      2
    )
  );
}

function parseJsonArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function nextRecentProjectTimestamp(userId: string): Promise<Date> {
  const db = getDb();
  const rows = await db
    .select({
      lastOpenedAt: projects.lastOpenedAt,
      updatedAt: projects.updatedAt,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(eq(projects.userId, userId));

  const maxExisting = rows.reduce((max, row) => {
    const candidates = [row.lastOpenedAt, row.updatedAt, row.createdAt]
      .filter((value): value is Date => value instanceof Date);
    const rowMax = candidates.reduce((innerMax, value) => Math.max(innerMax, value.getTime()), 0);
    return Math.max(max, rowMax);
  }, 0);
  const now = Date.now();
  return new Date(Math.max(now, maxExisting + 1000));
}

export interface CreateProjectInput {
  name: unknown;
  description?: unknown;
  notes?: unknown;
  icon?: unknown;
  teamIds?: unknown;
  ganttEnabled?: unknown;
  ganttPlan?: unknown;
  gitRemote?: unknown;
  gitBranch?: unknown;
  gitCommit?: unknown;
}

export async function listProjects(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.lastOpenedAt), desc(projects.updatedAt));
  return rows.map(safeProject);
}

export async function getProject(userId: string, projectId: string) {
  const db = getDb();
  const row = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  return row[0] ? safeProject(row[0]) : null;
}

export async function createProject(userId: string, input: CreateProjectInput) {
  const db = getDb();
  const name = normalizeText(input.name);
  if (!name) {
    throw new Error('项目名称不能为空');
  }

  const now = new Date();
  const id = generateId();
  const workspacePath = getProjectWorkspacePath(userId, id);
  const gitBranch = normalizeText(input.gitBranch, 'main') || 'main';

  await db.insert(projects).values({
    id,
    userId,
    name,
    description: normalizeText(input.description),
    notes: normalizeText(input.notes),
    icon: normalizeIcon(input.icon),
    workspacePath,
    teamIds: JSON.stringify(parseStringArray(input.teamIds)),
    ganttEnabled: input.ganttEnabled === true,
    ganttPlan: normalizeJsonArray(input.ganttPlan),
    gitRemote: normalizeText(input.gitRemote),
    gitBranch,
    gitCommit: normalizeText(input.gitCommit),
    status: 'active',
    lastOpenedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  const created = await getProject(userId, id);
  if (created) {
    writeProjectMetadata(created);
  }

  return created;
}

export async function updateProject(userId: string, projectId: string, input: Partial<CreateProjectInput>) {
  const db = getDb();
  const existing = await getProject(userId, projectId);
  if (!existing) return null;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) {
    const name = normalizeText(input.name);
    if (!name) throw new Error('项目名称不能为空');
    updateData.name = name;
  }
  if (input.description !== undefined) updateData.description = normalizeText(input.description);
  if (input.notes !== undefined) updateData.notes = normalizeText(input.notes);
  if (input.icon !== undefined) updateData.icon = normalizeIcon(input.icon);
  if (input.teamIds !== undefined) updateData.teamIds = JSON.stringify(parseStringArray(input.teamIds));
  if (input.ganttEnabled !== undefined) updateData.ganttEnabled = input.ganttEnabled === true;
  if (input.ganttPlan !== undefined) updateData.ganttPlan = normalizeJsonArray(input.ganttPlan);
  if (input.gitRemote !== undefined) updateData.gitRemote = normalizeText(input.gitRemote);
  if (input.gitBranch !== undefined) updateData.gitBranch = normalizeText(input.gitBranch, 'main') || 'main';
  if (input.gitCommit !== undefined) updateData.gitCommit = normalizeText(input.gitCommit);

  await db
    .update(projects)
    .set(updateData)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  const updated = await getProject(userId, projectId);
  if (updated) {
    writeProjectMetadata(updated);
  }
  return updated;
}

export async function touchProject(userId: string, projectId: string) {
  const db = getDb();
  const existing = await getProject(userId, projectId);
  if (!existing) return null;
  const touchedAt = await nextRecentProjectTimestamp(userId);

  await db
    .update(projects)
    .set({ lastOpenedAt: touchedAt, updatedAt: touchedAt })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  const touched = await getProject(userId, projectId);
  if (touched) {
    writeProjectMetadata(touched);
  }
  return touched;
}

export async function deleteProject(userId: string, projectId: string) {
  const db = getDb();
  const existing = await getProject(userId, projectId);
  if (!existing) return false;

  await db.delete(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  return true;
}

export function ensureProjectWorkspace(workspacePath: string): void {
  if (!fs.existsSync(workspacePath)) {
    fs.mkdirSync(workspacePath, { recursive: true });
  }
}
