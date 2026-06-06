'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { BackButton } from '@/components/ui/BackButton';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelInput } from '@/components/ui/PixelInput';
import { useStore } from '@/store/useStore';
import type { Project, ProjectGanttItem, ProjectInput } from '@/types';

const DEFAULT_ICON = '/project-icons/folder-blue.svg';
const PROJECT_ICON_OPTIONS = [
  { src: '/project-icons/folder-blue.svg', label: '蓝色' },
  { src: '/project-icons/folder-green.svg', label: '绿色' },
  { src: '/project-icons/folder-yellow.svg', label: '黄色' },
  { src: '/project-icons/folder-red.svg', label: '红色' },
  { src: '/project-icons/folder-gray.svg', label: '灰色' },
  { src: '/project-icons/folder-purple.svg', label: '紫色' },
];

const GANTT_STATUS_OPTIONS: Array<{ value: NonNullable<ProjectGanttItem['status']>; label: string; className: string }> = [
  { value: 'todo', label: '待办', className: 'bg-pixel-gray text-pixel-white' },
  { value: 'active', label: '进行中', className: 'bg-pixel-blue text-pixel-white' },
  { value: 'done', label: '完成', className: 'bg-pixel-green text-pixel-white' },
];

function FolderIcon({ src, className = 'h-14 w-14' }: { src?: string; className?: string }) {
  return (
    <img
      src={src || DEFAULT_ICON}
      alt=""
      className={`${className} object-contain`}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

function emptyForm(): ProjectInput {
  return {
    name: '',
    description: '',
    notes: '',
    icon: DEFAULT_ICON,
    teamIds: [],
    ganttEnabled: false,
    ganttPlan: [],
    gitRemote: '',
    gitBranch: 'main',
    gitCommit: '',
  };
}

function projectToForm(project: Project): ProjectInput {
  return {
    name: project.name,
    description: project.description,
    notes: project.notes,
    icon: project.icon || DEFAULT_ICON,
    teamIds: project.teamIds,
    ganttEnabled: project.ganttEnabled,
    ganttPlan: project.ganttPlan,
    gitRemote: project.gitRemote,
    gitBranch: project.gitBranch || 'main',
    gitCommit: project.gitCommit,
  };
}

function isGanttItem(value: unknown): value is ProjectGanttItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.title === 'string' && typeof item.start === 'string' && typeof item.end === 'string';
}

function getGanttPlan(form: ProjectInput): ProjectGanttItem[] {
  return Array.isArray(form.ganttPlan) ? form.ganttPlan.filter(isGanttItem) : [];
}

function makeGanttItem(): ProjectGanttItem {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: `phase-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: '新阶段',
    start: today,
    end: today,
    ownerTeamId: '',
    status: 'todo',
  };
}

function ProjectIconPicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (value: string) => void;
}) {
  const activeIcon = value || DEFAULT_ICON;

  return (
    <div className="border-4 border-pixel-black bg-pixel-white p-4">
      <div className="flex items-start gap-4">
        <div className="shrink-0 border-4 border-pixel-black bg-pixel-white p-2">
          <FolderIcon src={activeIcon} className="h-20 w-20 md:h-16 md:w-16" />
        </div>
        <div className="min-w-0 flex-1">
          <label className="mb-2 block font-pixel text-[1.25rem] font-bold text-pixel-black md:text-base">项目图标</label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 md:grid-cols-3 lg:grid-cols-6">
            {PROJECT_ICON_OPTIONS.map((option) => {
              const active = activeIcon === option.src;
              return (
                <button
                  key={option.src}
                  type="button"
                  onClick={() => onChange(option.src)}
                  title={option.label}
                  aria-label={`选择${option.label}项目图标`}
                  className={`flex h-14 w-14 items-center justify-center border-2 border-pixel-black bg-pixel-white p-1 ${
                    active ? 'ring-4 ring-pixel-yellow' : 'hover:bg-pixel-yellow/40'
                  }`}
                >
                  <FolderIcon src={option.src} className="h-10 w-10" />
                </button>
              );
            })}
          </div>
          <PixelInput
            value={activeIcon}
            onChange={(nextValue) => onChange(nextValue || DEFAULT_ICON)}
            placeholder={DEFAULT_ICON}
            className="mt-3 min-h-[56px] text-[1.15rem] md:min-h-0 md:text-base"
          />
        </div>
      </div>
    </div>
  );
}

function ProjectGanttEditor({
  enabled,
  plan,
  teams,
  onEnabledChange,
  onAdd,
  onUpdate,
  onRemove,
}: {
  enabled?: boolean;
  plan: ProjectGanttItem[];
  teams: Array<{ id: string; name: string }>;
  onEnabledChange: (enabled: boolean) => void;
  onAdd: () => void;
  onUpdate: <K extends keyof ProjectGanttItem>(index: number, key: K, value: ProjectGanttItem[K]) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="border-4 border-pixel-black bg-pixel-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-3 font-pixel text-[1.25rem] font-bold text-pixel-black md:text-base">
          <input
            type="checkbox"
            checked={enabled || false}
            onChange={(event) => onEnabledChange(event.target.checked)}
            className="h-7 w-7 md:h-5 md:w-5"
          />
          启用时间甘特图
        </label>
        <button
          type="button"
          onClick={onAdd}
          className="shrink-0 border-2 border-pixel-black bg-pixel-blue px-3 py-2 font-pixel text-base text-pixel-white hover:bg-pixel-gray md:px-2 md:py-1 md:text-xs"
          style={{ boxShadow: '2px 2px 0 #101010' }}
        >
          + 阶段
        </button>
      </div>
      <p className="mb-3 font-pixel text-[1.05rem] leading-snug text-pixel-black/55 md:text-sm">
        记录项目阶段、时间范围和负责团队，后续团队执行时可以读取这些计划上下文。
      </p>
      {plan.length > 0 ? (
        <div className="space-y-3">
          {plan.map((item, index) => (
            <div key={item.id || index} className="border-2 border-pixel-black bg-pixel-white p-3" style={{ boxShadow: '3px 3px 0 #101010' }}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-pixel text-[1.1rem] font-bold text-pixel-black md:text-sm">阶段 {index + 1}</p>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="border-2 border-pixel-black bg-pixel-red px-2 py-1 font-pixel text-xs text-pixel-white"
                >
                  删除
                </button>
              </div>
              <div className="grid gap-2">
                <PixelInput
                  value={item.title}
                  onChange={(nextValue) => onUpdate(index, 'title', nextValue)}
                  placeholder="阶段标题"
                  className="min-h-[52px] text-[1.1rem] md:min-h-0 md:text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <PixelInput
                    type="date"
                    value={item.start}
                    onChange={(nextValue) => onUpdate(index, 'start', nextValue)}
                    placeholder="开始日期"
                    className="min-h-[52px] text-[1.05rem] md:min-h-0 md:text-sm"
                  />
                  <PixelInput
                    type="date"
                    value={item.end}
                    onChange={(nextValue) => onUpdate(index, 'end', nextValue)}
                    placeholder="结束日期"
                    className="min-h-[52px] text-[1.05rem] md:min-h-0 md:text-sm"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <select
                    value={item.ownerTeamId || ''}
                    onChange={(event) => onUpdate(index, 'ownerTeamId', event.target.value)}
                    className="min-h-[52px] border-4 border-pixel-black bg-pixel-white px-3 py-2 font-pixel text-[1.05rem] text-pixel-black md:min-h-0 md:text-sm"
                    style={{ boxShadow: 'inset 2px 2px 0px 0px #101010' }}
                  >
                    <option value="">未指定团队</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-1">
                    {GANTT_STATUS_OPTIONS.map((status) => {
                      const active = (item.status || 'todo') === status.value;
                      return (
                        <button
                          key={status.value}
                          type="button"
                          onClick={() => onUpdate(index, 'status', status.value)}
                          className={`border-2 border-pixel-black px-2 py-1 font-pixel text-xs ${
                            active ? status.className : 'bg-pixel-white text-pixel-black'
                          }`}
                        >
                          {status.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          className="w-full border-2 border-dashed border-pixel-black p-4 text-left font-pixel text-[1.1rem] text-pixel-black/60 hover:bg-pixel-yellow/30 md:text-sm"
        >
          还没有阶段，点击添加第一个项目阶段
        </button>
      )}
    </div>
  );
}

function formatTime(value?: string | null) {
  if (!value) return '尚未打开';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '尚未打开';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-pixel text-pixel-black/50">加载中...</div>}>
      <ProjectsPageInner />
    </Suspense>
  );
}

function ProjectsPageInner() {
  const searchParams = useSearchParams();
  const {
    projects,
    architectures,
    initialize,
    fetchProjects,
    createProjectAPI,
    updateProjectAPI,
    openProjectAPI,
    deleteProjectAPI,
  } = useStore();

  const requestedProjectId = searchParams.get('project');
  const [selectedId, setSelectedId] = useState<string | null>(requestedProjectId);
  const [form, setForm] = useState<ProjectInput>(() => emptyForm());
  const [isCreating, setIsCreating] = useState(!requestedProjectId);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedId) || null,
    [projects, selectedId]
  );

  useEffect(() => {
    if (requestedProjectId) {
      setSelectedId(requestedProjectId);
      setIsCreating(false);
    }
  }, [requestedProjectId]);

  useEffect(() => {
    if (selectedProject && !isCreating) {
      setForm(projectToForm(selectedProject));
    }
  }, [selectedProject, isCreating]);

  useEffect(() => {
    if (!selectedId && projects.length > 0 && !isCreating) {
      setSelectedId(projects[0].id);
    }
  }, [projects, selectedId, isCreating]);

  const updateForm = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleTeam = (teamId: string) => {
    const teamIds = form.teamIds || [];
    updateForm(
      'teamIds',
      teamIds.includes(teamId)
        ? teamIds.filter((id) => id !== teamId)
        : [...teamIds, teamId]
    );
  };

  const addGanttItem = () => {
    updateForm('ganttEnabled', true);
    updateForm('ganttPlan', [...getGanttPlan(form), makeGanttItem()]);
  };

  const updateGanttItem = <K extends keyof ProjectGanttItem>(
    index: number,
    key: K,
    value: ProjectGanttItem[K]
  ) => {
    updateForm(
      'ganttPlan',
      getGanttPlan(form).map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    );
  };

  const removeGanttItem = (index: number) => {
    const nextPlan = getGanttPlan(form).filter((_, itemIndex) => itemIndex !== index);
    updateForm('ganttPlan', nextPlan);
    if (nextPlan.length === 0) {
      updateForm('ganttEnabled', false);
    }
  };

  const handleNew = () => {
    setSelectedId(null);
    setIsCreating(true);
    setForm(emptyForm());
    setMessage('');
  };

  const handleSelect = async (project: Project) => {
    setSelectedId(project.id);
    setIsCreating(false);
    setForm(projectToForm(project));
    setMessage('');
    try {
      await openProjectAPI(project.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '打开项目失败');
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setMessage('项目名称不能为空');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      if (isCreating) {
        const project = await createProjectAPI(form);
        setSelectedId(project.id);
        setIsCreating(false);
        setForm(projectToForm(project));
        setMessage('项目已创建，并已生成服务器工作空间');
      } else if (selectedProject) {
        const project = await updateProjectAPI(selectedProject.id, form);
        setForm(projectToForm(project));
        setMessage('项目已保存');
      }
      await fetchProjects();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存项目失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProject) return;
    const confirmed = window.confirm(`确定删除项目「${selectedProject.name}」吗？服务器工作空间文件会保留，项目记录会删除。`);
    if (!confirmed) return;

    setSaving(true);
    setMessage('');
    try {
      await deleteProjectAPI(selectedProject.id);
      setSelectedId(null);
      setIsCreating(true);
      setForm(emptyForm());
      setMessage('项目记录已删除');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除项目失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-mobile-projects-page="true" className="mx-auto max-w-6xl px-2 pb-48 md:px-4 md:pb-16">
      <div className="hidden md:block">
        <BackButton href="/" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 border-b-4 border-pixel-black bg-pixel-white pb-4 text-left md:mb-6 md:border-b-0 md:bg-transparent md:pb-0 md:text-center"
      >
        <p className="font-pixel text-[1.35rem] leading-none text-pixel-black/55 md:hidden">PROJECT WORKSPACES</p>
        <div className="mt-2 flex items-center justify-between gap-3 md:block">
          <div className="min-w-0">
            <h1 className="truncate font-pixel text-[3rem] font-bold leading-none text-pixel-black md:chinese-large md:mb-2">
              我的项目
            </h1>
            <p className="hidden font-pixel text-xl text-pixel-blue md:block">PROJECT WORKSPACES</p>
          </div>
          <button
            type="button"
            onClick={handleNew}
            className="flex h-[74px] w-[74px] shrink-0 items-center justify-center border-4 border-pixel-black bg-pixel-blue font-pixel text-4xl leading-none text-pixel-white md:hidden"
            style={{ boxShadow: '4px 4px 0 #101010' }}
            aria-label="新建项目"
          >
            +
          </button>
        </div>
        <p className="mt-2 font-pixel text-[1.2rem] leading-snug text-pixel-black/60 md:text-sm">
          每个项目对应服务器上的个人工作空间，可绑定一个或多个 Agent 团队。
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 md:hidden">
          <div className="border-2 border-pixel-black bg-pixel-blue px-2 py-2 text-center text-pixel-white">
            <p className="font-pixel text-base leading-none">项目</p>
            <p className="mt-1 font-pixel text-[1.7rem] leading-none">{projects.length}</p>
          </div>
          <div className="border-2 border-pixel-black bg-pixel-green px-2 py-2 text-center text-pixel-white">
            <p className="font-pixel text-base leading-none">团队</p>
            <p className="mt-1 font-pixel text-[1.7rem] leading-none">{architectures.length}</p>
          </div>
          <div className="border-2 border-pixel-black bg-pixel-yellow px-2 py-2 text-center text-pixel-black">
            <p className="font-pixel text-base leading-none">已绑定</p>
            <p className="mt-1 font-pixel text-[1.7rem] leading-none">{form.teamIds?.length || 0}</p>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="border-4 border-pixel-black bg-pixel-white" style={{ boxShadow: '6px 6px 0 #101010' }}>
          <div className="flex items-center justify-between border-b-4 border-pixel-black p-4">
            <div>
              <p className="font-pixel text-[1.8rem] font-bold leading-none text-pixel-black md:text-xl">项目列表</p>
              <p className="mt-1 font-pixel text-[1.15rem] leading-none text-pixel-black/55 md:text-sm">{projects.length} 个工作空间</p>
            </div>
            <PixelButton size="sm" onClick={handleNew} className="min-h-[48px] md:min-h-0">新建</PixelButton>
          </div>

          <div className="max-h-[360px] overflow-y-auto p-3 md:max-h-[620px]">
            {projects.length > 0 ? (
              <div className="space-y-3">
                {projects.map((project) => {
                  const active = project.id === selectedId && !isCreating;
                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => void handleSelect(project)}
                      className={`w-full min-h-[116px] border-4 border-pixel-black p-3 text-left transition-colors md:min-h-0 ${
                        active ? 'bg-pixel-yellow' : 'bg-pixel-white hover:bg-pixel-yellow/60'
                      }`}
                      style={{ boxShadow: '4px 4px 0 #101010' }}
                    >
                      <div className="flex items-start gap-3">
                        <FolderIcon src={project.icon} className="h-[72px] w-[72px] shrink-0 md:h-12 md:w-12" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-pixel text-[1.65rem] font-bold leading-none text-pixel-black md:text-lg md:leading-normal">{project.name}</p>
                          <p className="mt-2 truncate font-pixel text-[1.15rem] leading-none text-pixel-black/60 md:mt-1 md:text-sm md:leading-normal">
                            {project.teamIds.length} 个团队 · {project.gitBranch || 'main'}
                          </p>
                          <p className="mt-2 font-pixel text-base leading-none text-pixel-black/45 md:mt-1 md:text-xs md:leading-normal">最近：{formatTime(project.lastOpenedAt)}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="border-4 border-dashed border-pixel-black p-6 text-center">
                <FolderIcon className="mx-auto h-20 w-20 md:h-16 md:w-16" />
                <p className="mt-3 font-pixel text-[1.45rem] text-pixel-black/60 md:text-base">还没有项目</p>
              </div>
            )}
          </div>
        </aside>

        <section className="border-4 border-pixel-black bg-pixel-white" style={{ boxShadow: '6px 6px 0 #101010' }}>
          <div className="border-b-4 border-pixel-black p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-pixel text-[2rem] font-bold leading-none text-pixel-black md:text-2xl md:leading-normal">
                  {isCreating ? '新建项目' : selectedProject?.name || '选择项目'}
                </p>
                <p className="mt-2 break-all font-pixel text-[1.05rem] leading-snug text-pixel-black/55 md:mt-0 md:text-sm">
                  {selectedProject?.workspacePath || '保存后会自动生成服务器个人工作空间'}
                </p>
              </div>
              {!isCreating && selectedProject && (
                <PixelButton variant="danger" size="sm" onClick={handleDelete} disabled={saving} className="min-h-[48px] md:min-h-0">
                  删除
                </PixelButton>
              )}
            </div>
          </div>

          <div className="grid gap-5 p-4 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block font-pixel text-[1.25rem] font-bold text-pixel-black md:text-base">项目名称 *</label>
                <PixelInput value={form.name} onChange={(value) => updateForm('name', value)} placeholder="例如：论文返修自动化项目" className="min-h-[56px] text-[1.25rem] md:min-h-0 md:text-base" />
              </div>
              <div>
                <label className="mb-2 block font-pixel text-[1.25rem] font-bold text-pixel-black md:text-base">项目简介</label>
                <PixelInput
                  value={form.description || ''}
                  onChange={(value) => updateForm('description', value)}
                  placeholder="这个项目要完成什么？"
                  multiline
                  rows={3}
                  compactMultiline
                  className="text-[1.15rem] md:text-base"
                />
              </div>
              <div>
                <label className="mb-2 block font-pixel text-[1.25rem] font-bold text-pixel-black md:text-base">备注</label>
                <PixelInput
                  value={form.notes || ''}
                  onChange={(value) => updateForm('notes', value)}
                  placeholder="背景、注意事项、交付标准..."
                  multiline
                  rows={4}
                  className="text-[1.15rem] md:text-base"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block font-pixel text-[1.25rem] font-bold text-pixel-black md:text-base">Git 分支</label>
                  <PixelInput value={form.gitBranch || ''} onChange={(value) => updateForm('gitBranch', value)} placeholder="main" className="min-h-[56px] text-[1.25rem] md:min-h-0 md:text-base" />
                </div>
                <div>
                  <label className="mb-2 block font-pixel text-[1.25rem] font-bold text-pixel-black md:text-base">Git 版本</label>
                  <PixelInput value={form.gitCommit || ''} onChange={(value) => updateForm('gitCommit', value)} placeholder="commit hash 可选" className="min-h-[56px] text-[1.25rem] md:min-h-0 md:text-base" />
                </div>
              </div>
              <div>
                <label className="mb-2 block font-pixel text-[1.25rem] font-bold text-pixel-black md:text-base">Git 远端</label>
                <PixelInput value={form.gitRemote || ''} onChange={(value) => updateForm('gitRemote', value)} placeholder="https://github.com/..." className="min-h-[56px] text-[1.25rem] md:min-h-0 md:text-base" />
              </div>
            </div>

            <div className="space-y-4">
              <ProjectIconPicker
                value={form.icon}
                onChange={(value) => updateForm('icon', value)}
              />

              <div className="border-4 border-pixel-black bg-pixel-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-pixel text-[1.35rem] font-bold leading-none text-pixel-black md:text-base md:leading-normal">绑定团队</p>
                    <p className="mt-1 font-pixel text-[1.05rem] leading-none text-pixel-black/55 md:text-sm md:leading-normal">一个项目可以调度一个或多个团队</p>
                  </div>
                  <span className="border-2 border-pixel-black bg-pixel-blue px-3 py-2 font-pixel text-base text-pixel-white md:px-2 md:py-1 md:text-xs">
                    {(form.teamIds || []).length}
                  </span>
                </div>
                {architectures.length > 0 ? (
                  <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                    {architectures.map((team) => {
                      const checked = (form.teamIds || []).includes(team.id);
                      return (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => toggleTeam(team.id)}
                          className={`w-full min-h-[52px] border-2 border-pixel-black p-3 text-left font-pixel text-[1.1rem] md:min-h-0 md:p-2 md:text-sm ${
                            checked ? 'bg-pixel-green text-pixel-white' : 'bg-pixel-white text-pixel-black hover:bg-pixel-yellow'
                          }`}
                        >
                          {checked ? '[x]' : '[ ]'} {team.name}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="font-pixel text-sm text-pixel-black/55">还没有团队。可以先创建团队，再回到这里绑定。</p>
                )}
              </div>

              <ProjectGanttEditor
                enabled={form.ganttEnabled}
                plan={getGanttPlan(form)}
                teams={architectures.map((team) => ({ id: team.id, name: team.name }))}
                onEnabledChange={(enabled) => updateForm('ganttEnabled', enabled)}
                onAdd={addGanttItem}
                onUpdate={updateGanttItem}
                onRemove={removeGanttItem}
              />

              {selectedProject && (
                <div className="border-4 border-pixel-black bg-pixel-black/5 p-4">
                  <p className="font-pixel text-[1.25rem] font-bold text-pixel-black md:text-base">服务器工作空间</p>
                  <p className="mt-2 break-all font-pixel text-[1.05rem] leading-snug text-pixel-black/65 md:text-sm">{selectedProject.workspacePath}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-stretch justify-between gap-3 border-t-4 border-pixel-black p-4 md:flex-row md:items-center">
            <p className="min-h-[28px] font-pixel text-[1.05rem] leading-snug text-pixel-black/65 md:text-sm">{message}</p>
            <PixelButton onClick={handleSave} disabled={saving || !form.name.trim()} className="min-h-[58px] text-[1.25rem] md:min-h-0 md:text-base">
              {saving ? '保存中...' : isCreating ? '创建项目' : '保存项目'}
            </PixelButton>
          </div>
        </section>
      </div>
    </div>
  );
}
