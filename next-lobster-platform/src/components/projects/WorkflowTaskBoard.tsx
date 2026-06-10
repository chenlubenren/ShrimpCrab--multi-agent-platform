'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  Deliverable,
  DeliverableStatus,
  Lobster,
  WorkflowExecution,
  WorkflowExecutionStatus,
  WorkflowNodeExecutionStatus,
} from '@/types';

type BoardTab = 'tasks' | 'deliverables';

const NODE_STATUS_META: Record<WorkflowNodeExecutionStatus, { label: string; className: string }> = {
  pending: { label: '等待', className: 'bg-pixel-white text-pixel-black/60' },
  ready: { label: '就绪', className: 'bg-pixel-yellow/60 text-pixel-black' },
  running: { label: '运行中', className: 'bg-pixel-yellow text-pixel-black' },
  succeeded: { label: '完成', className: 'bg-pixel-green text-pixel-white' },
  failed: { label: '失败', className: 'bg-pixel-red text-pixel-white' },
  skipped: { label: '跳过', className: 'bg-pixel-white text-pixel-black/40' },
};

const EXECUTION_STATUS_META: Record<WorkflowExecutionStatus, { label: string; className: string }> = {
  queued: { label: '排队中', className: 'bg-pixel-yellow text-pixel-black' },
  running: { label: '执行中', className: 'bg-pixel-yellow text-pixel-black' },
  succeeded: { label: '已完成', className: 'bg-pixel-green text-pixel-white' },
  failed: { label: '失败', className: 'bg-pixel-red text-pixel-white' },
  cancelled: { label: '已取消', className: 'bg-pixel-red text-pixel-white' },
};

const DELIVERABLE_STATUS_META: Record<DeliverableStatus, { label: string; className: string }> = {
  pending: { label: '待验收', className: 'bg-pixel-yellow text-pixel-black' },
  accepted: { label: '已验收', className: 'bg-pixel-green text-pixel-white' },
  revision: { label: '需修订', className: 'bg-pixel-red text-pixel-white' },
  superseded: { label: '已被覆盖', className: 'bg-pixel-white text-pixel-black/40' },
};

export function WorkflowTaskBoard({
  execution,
  agents = [],
  deliverables = [],
  onOpenFile,
  onReviewDeliverable,
  reviewingDeliverableId,
}: {
  execution: WorkflowExecution | null;
  agents?: Lobster[];
  deliverables?: Deliverable[];
  onOpenFile?: (relativePath: string) => void;
  onReviewDeliverable?: (deliverableId: string, status: 'accepted' | 'revision') => void;
  reviewingDeliverableId?: string | null;
}) {
  const [tab, setTab] = useState<BoardTab>('tasks');
  const [nowMs, setNowMs] = useState(() => Date.now());

  const agentNodes = useMemo(() => {
    if (!execution) return [];
    const dslOrder = new Map(execution.workflowDsl?.nodes?.map((node, index) => [node.id, index]) ?? []);
    return Object.values(execution.nodeStates)
      .filter((state) => state.type === 'agent')
      .sort((a, b) => (dslOrder.get(a.nodeId) ?? 0) - (dslOrder.get(b.nodeId) ?? 0));
  }, [execution]);

  const hasRunning = agentNodes.some((node) => node.status === 'running');

  useEffect(() => {
    if (!hasRunning) return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [hasRunning]);

  const progress = useMemo(() => {
    if (!execution) return { completed: 0, total: 0, percent: 0 };
    const states = Object.values(execution.nodeStates);
    const total = states.length;
    if (total === 0) return { completed: 0, total: 0, percent: 0 };
    const completed = states.filter((state) => state.status === 'succeeded' || state.status === 'skipped').length;
    return { completed, total, percent: Math.round((completed / total) * 100) };
  }, [execution]);

  const visibleDeliverables = useMemo(
    () => deliverables.filter((item) => item.status !== 'superseded'),
    [deliverables]
  );
  const agentLookup = useMemo(() => {
    const byId = new Map<string, Lobster>();
    const byName = new Map<string, Lobster>();
    for (const agent of agents) {
      byId.set(agent.id, agent);
      byName.set(agent.name, agent);
    }
    return { byId, byName };
  }, [agents]);
  const pendingCount = visibleDeliverables.filter((item) => item.status === 'pending').length;

  const executionMeta = execution ? EXECUTION_STATUS_META[execution.status] : null;

  return (
    <aside className="flex w-full shrink-0 flex-col border-t-4 border-pixel-black bg-pixel-white lg:w-[300px] lg:border-l-4 lg:border-t-0">
      <div className="flex items-center justify-between gap-2 border-b-4 border-pixel-black p-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab('tasks')}
            className={`border-2 border-pixel-black px-2 py-1 font-pixel text-xs ${tab === 'tasks' ? 'bg-pixel-yellow text-pixel-black' : 'bg-pixel-white text-pixel-black/60 hover:bg-pixel-yellow/40'}`}
          >
            任务板
          </button>
          <button
            type="button"
            onClick={() => setTab('deliverables')}
            className={`border-2 border-pixel-black px-2 py-1 font-pixel text-xs ${tab === 'deliverables' ? 'bg-pixel-yellow text-pixel-black' : 'bg-pixel-white text-pixel-black/60 hover:bg-pixel-yellow/40'}`}
          >
            产物{pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        </div>
        {executionMeta && (
          <span className={`border-2 border-pixel-black px-2 py-0.5 font-pixel text-[10px] ${executionMeta.className}`}>
            {executionMeta.label}
          </span>
        )}
      </div>

      {tab === 'tasks' ? (
        <div className="flex-1 overflow-y-auto p-2">
          {!execution ? (
            <p className="p-3 text-center font-pixel text-xs text-pixel-black/50">还没有执行记录。提交任务后，这里会实时显示每个 Agent 的工作状态。</p>
          ) : (
            <>
              <div className="mb-2 border-2 border-pixel-black p-2">
                <div className="h-3 overflow-hidden border-2 border-pixel-black bg-pixel-white">
                  <div className="h-full bg-pixel-green transition-all" style={{ width: `${progress.percent}%` }} />
                </div>
                <div className="mt-1 flex items-center justify-between font-pixel text-[10px] text-pixel-black/60">
                  <span>{progress.total > 0 ? `${progress.completed}/${progress.total} 节点完成` : '等待任务'}</span>
                  <span>{progress.percent}%</span>
                </div>
              </div>

              {agentNodes.map((node) => {
                const meta = NODE_STATUS_META[node.status];
                const duration = nodeDuration(node.startedAt, node.completedAt, node.status === 'running' ? nowMs : undefined);
                const agent = (node.agentInstanceId ? agentLookup.byId.get(node.agentInstanceId) : undefined)
                  ?? agentLookup.byName.get(node.agentName || '');
                const agentName = agent?.name || node.agentName || node.label;
                const agentAvatar = agent?.avatar || '/claw_profile/03.png';
                return (
                  <div key={node.nodeId} className={`mb-2 border-2 border-pixel-black p-2 ${node.status === 'running' ? 'bg-pixel-yellow/20' : 'bg-pixel-white'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center border-2 border-pixel-black bg-pixel-white ${node.status === 'running' ? 'animate-online-agent-profile' : ''}`}>
                          <img
                            src={agentAvatar}
                            alt=""
                            className="h-7 w-7 object-contain"
                            style={{ imageRendering: 'pixelated' }}
                          />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-pixel text-xs font-bold text-pixel-black">
                            {agentName}
                          </span>
                          {node.role && (
                            <span className="block truncate font-pixel text-[10px] text-pixel-black/45">
                              {node.role}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className={`shrink-0 border-2 border-pixel-black px-1.5 py-0.5 font-pixel text-[10px] ${node.degraded ? 'bg-pixel-red text-pixel-white' : meta.className}`}>
                        {node.degraded ? '降级' : node.status === 'running' ? `${meta.label}…` : meta.label}
                      </span>
                    </div>
                    {node.degraded && (
                      <p className="mt-1 border-2 border-pixel-red bg-pixel-red/10 p-1 font-pixel text-[10px] leading-snug text-pixel-red">
                        未真正执行：未配置可用的 LLM API Key。请在「管理团队 → 配置团队 API Key」中绑定后重试。
                      </p>
                    )}
                    {node.task && (
                      <p className="mt-1 line-clamp-2 font-pixel text-[10px] leading-snug text-pixel-black/60">{node.task}</p>
                    )}
                    <div className="mt-1 flex items-center justify-between font-pixel text-[10px] text-pixel-black/45">
                      <span>{node.runCount > 1 ? `第 ${node.runCount} 轮` : ''}</span>
                      <span>{duration}</span>
                    </div>
                    {node.error && (
                      <p className="mt-1 font-pixel text-[10px] text-pixel-red">{node.error}</p>
                    )}
                  </div>
                );
              })}

              {execution.error && (
                <p className="mt-2 border-2 border-pixel-red p-2 font-pixel text-[10px] text-pixel-red">{execution.error}</p>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2">
          {visibleDeliverables.length === 0 ? (
            <p className="p-3 text-center font-pixel text-xs text-pixel-black/50">还没有登记的交付物。Agent 在工作区生成或修改文件后会自动出现在这里。</p>
          ) : (
            visibleDeliverables.map((item) => {
              const meta = DELIVERABLE_STATUS_META[item.status];
              const fileName = item.filePath.split('/').pop() || item.filePath;
              const reviewing = reviewingDeliverableId === item.id;
              const agent = agentLookup.byName.get(item.agentName || '');
              return (
                <div key={item.id} className="mb-2 border-2 border-pixel-black bg-pixel-white p-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenFile?.(item.filePath)}
                      className="min-w-0 flex-1 truncate text-left font-pixel text-xs font-bold text-pixel-black underline-offset-2 hover:underline"
                      title={item.filePath}
                    >
                      {fileName}
                    </button>
                    <span className={`shrink-0 border-2 border-pixel-black px-1.5 py-0.5 font-pixel text-[10px] ${meta.className}`}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-pixel text-[10px] text-pixel-black/50" title={item.filePath}>{item.filePath}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 font-pixel text-[10px] text-pixel-black/45">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-pixel-black bg-pixel-white">
                        <img
                          src={agent?.avatar || '/claw_profile/03.png'}
                          alt=""
                          className="h-5 w-5 object-contain"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      </span>
                      <span className="truncate">{item.agentName || '未知 Agent'}</span>
                    </span>
                    {item.status === 'pending' && onReviewDeliverable && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={reviewing}
                          onClick={() => onReviewDeliverable(item.id, 'accepted')}
                          className="border-2 border-pixel-black bg-pixel-green px-1.5 py-0.5 font-pixel text-[10px] text-pixel-white hover:brightness-95 disabled:opacity-50"
                        >
                          验收
                        </button>
                        <button
                          type="button"
                          disabled={reviewing}
                          onClick={() => onReviewDeliverable(item.id, 'revision')}
                          className="border-2 border-pixel-black bg-pixel-red px-1.5 py-0.5 font-pixel text-[10px] text-pixel-white hover:brightness-95 disabled:opacity-50"
                        >
                          打回
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </aside>
  );
}

function nodeDuration(startedAt?: string, completedAt?: string, runningNowMs?: number): string {
  if (!startedAt) return '';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : runningNowMs;
  if (!end || !Number.isFinite(start) || end < start) return '';
  const totalSec = Math.round((end - start) / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return `${min}m${sec > 0 ? ` ${sec}s` : ''}`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}
