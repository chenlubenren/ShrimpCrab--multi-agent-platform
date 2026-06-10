/**
 * Deliverable Service
 *
 * Workflow-produced workspace files registered as reviewable deliverables.
 * Status machine: pending -> accepted | revision; older pending versions of
 * the same file become superseded when a new version is registered.
 */

import crypto from 'crypto';
import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { deliverables, type DeliverableRow } from '../db/schema.js';

export type DeliverableStatus = 'pending' | 'accepted' | 'revision' | 'superseded';

export interface Deliverable {
  id: string;
  userId: string;
  projectId: string;
  executionId: string;
  nodeId?: string;
  agentName?: string;
  filePath: string;
  kind: string;
  status: DeliverableStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterDeliverableInput {
  userId: string;
  projectId: string;
  executionId: string;
  nodeId?: string;
  agentName?: string;
  /** Relative path within the project workspace */
  filePath: string;
  kind?: string;
}

function generateId(): string {
  return crypto.randomBytes(16).toString('hex');
}

function toDeliverable(row: DeliverableRow): Deliverable {
  return {
    id: row.id,
    userId: row.userId,
    projectId: row.projectId,
    executionId: row.executionId,
    nodeId: row.nodeId ?? undefined,
    agentName: row.agentName ?? undefined,
    filePath: row.filePath,
    kind: row.kind,
    status: row.status as DeliverableStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Register a workflow output file as a deliverable. Any previous pending
 * deliverable for the same project+file is marked superseded.
 */
export function registerDeliverable(input: RegisterDeliverableInput): Deliverable {
  const db = getDb();
  const now = new Date();

  // Supersede older pending versions of the same file
  db.update(deliverables)
    .set({ status: 'superseded', updatedAt: now })
    .where(
      and(
        eq(deliverables.projectId, input.projectId),
        eq(deliverables.filePath, input.filePath),
        eq(deliverables.status, 'pending')
      )
    )
    .run();

  const row: DeliverableRow = {
    id: generateId(),
    userId: input.userId,
    projectId: input.projectId,
    executionId: input.executionId,
    nodeId: input.nodeId ?? null,
    agentName: input.agentName ?? null,
    filePath: input.filePath,
    kind: input.kind ?? 'workspace-file',
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  db.insert(deliverables).values(row).run();
  return toDeliverable(row);
}

export function listProjectDeliverables(userId: string, projectId: string): Deliverable[] {
  const db = getDb();
  const rows = db
    .select()
    .from(deliverables)
    .where(and(eq(deliverables.userId, userId), eq(deliverables.projectId, projectId)))
    .orderBy(desc(deliverables.createdAt))
    .all();
  return rows.map(toDeliverable);
}

export function reviewDeliverable(
  userId: string,
  deliverableId: string,
  status: 'accepted' | 'revision'
): Deliverable | null {
  const db = getDb();
  const existing = db
    .select()
    .from(deliverables)
    .where(and(eq(deliverables.id, deliverableId), eq(deliverables.userId, userId)))
    .get();
  if (!existing) return null;

  const now = new Date();
  db.update(deliverables)
    .set({ status, updatedAt: now })
    .where(eq(deliverables.id, deliverableId))
    .run();
  return toDeliverable({ ...existing, status, updatedAt: now });
}
