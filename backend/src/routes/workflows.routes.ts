import { Router, Response } from 'express';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import {
  generateWorkflowDslFromPrompt,
  type AvailableAgentForWorkflow,
} from '../services/workflow-dsl.service.js';
import {
  workflowExecutor,
  type WorkflowDsl,
} from '../services/workflow-executor.service.js';

const router = Router();

router.use(authMiddleware);

router.post('/generate-dsl', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, availableAgents } = req.body as {
      prompt?: unknown;
      availableAgents?: unknown;
    };

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      res.status(400).json({ message: '请提供自然语言工作流描述' });
      return;
    }

    const agents = normalizeAvailableAgents(availableAgents);
    const result = await generateWorkflowDslFromPrompt(prompt.trim(), agents);
    res.json(result);
  } catch (error) {
    console.error('Generate workflow DSL error:', error);
    res.status(500).json({
      message: error instanceof Error ? error.message : '生成 Workflow DSL 失败',
    });
  }
});

router.post('/execute', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { workflowDsl, task, architectureId, projectId, dryRun } = req.body as {
      workflowDsl?: unknown;
      task?: unknown;
      architectureId?: unknown;
      projectId?: unknown;
      dryRun?: unknown;
    };

    if (!isWorkflowDsl(workflowDsl)) {
      res.status(400).json({ message: 'Please provide a valid Workflow DSL.' });
      return;
    }
    if (typeof task !== 'string' || task.trim().length === 0) {
      res.status(400).json({ message: 'Please provide a task to execute.' });
      return;
    }

    const execution = await workflowExecutor.start({
      userId: req.user!.userId,
      architectureId: typeof architectureId === 'string' ? architectureId : undefined,
      projectId: typeof projectId === 'string' ? projectId : undefined,
      workflowDsl,
      task: task.trim(),
      dryRun: dryRun === true,
    });

    res.status(202).json({ execution });
  } catch (error) {
    console.error('Start workflow execution error:', error);
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to start workflow execution',
    });
  }
});

router.get('/executions', async (req: AuthenticatedRequest, res: Response) => {
  const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
  if (projectId) {
    const executions = workflowExecutor.loadProjectExecutions(req.user!.userId, projectId);
    res.json({ executions });
    return;
  }
  res.json({ executions: workflowExecutor.list(req.user!.userId) });
});

router.get('/executions/:id', async (req: AuthenticatedRequest, res: Response) => {
  const execution = workflowExecutor.get(String(req.params.id), req.user!.userId);
  if (!execution) {
    res.status(404).json({ message: 'Workflow execution not found.' });
    return;
  }
  res.json({ execution });
});

router.post('/executions/:id/cancel', async (req: AuthenticatedRequest, res: Response) => {
  const execution = workflowExecutor.cancel(String(req.params.id), req.user!.userId);
  if (!execution) {
    res.status(404).json({ message: 'Workflow execution not found.' });
    return;
  }
  res.json({ execution });
});

function normalizeAvailableAgents(value: unknown): AvailableAgentForWorkflow[] {
  if (!Array.isArray(value)) return [];
  const agents: AvailableAgentForWorkflow[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.name !== 'string') continue;
    agents.push({
      id: row.id,
      name: row.name,
      role: typeof row.role === 'string' ? row.role : undefined,
      description: typeof row.description === 'string' ? row.description : undefined,
      tags: Array.isArray(row.tags)
        ? row.tags.filter((tag): tag is string => typeof tag === 'string')
        : undefined,
    });
  }

  return agents;
}

function isWorkflowDsl(value: unknown): value is WorkflowDsl {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return row.schemaVersion === '1.0' &&
    typeof row.name === 'string' &&
    typeof row.entryNodeId === 'string' &&
    Array.isArray(row.nodes) &&
    Array.isArray(row.edges) &&
    Boolean(row.execution && typeof row.execution === 'object');
}

export default router;
