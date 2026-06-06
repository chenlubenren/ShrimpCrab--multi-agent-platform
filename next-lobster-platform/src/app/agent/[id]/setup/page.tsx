'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  PixelCanvas,
  EMPTY_PIXEL,
  DEFAULT_GRID,
  GRID_SIZE_OPTIONS,
} from '@/components/pixel/PixelCanvas';
import { PixelButton } from '@/components/ui/PixelButton';
import { useAuthStore } from '@/store/useAuthStore';
import {
  generateAgentAvatar,
  getAgent,
  publishAgent,
  type Agent,
  updateAgent,
  uploadAgentAvatarFile,
} from '@/lib/auth';

type AvatarMode = 'pixel' | 'random' | 'ai';

const OUTPUT_SIZES = [64, 96, 128, 192];
const RANDOM_COLORS = [
  '#E74C3C',
  '#F1C40F',
  '#2ECC71',
  '#3498DB',
  '#9B59B6',
  '#111111',
];

function createEmptyPixels(size: number): string[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => EMPTY_PIXEL)
  );
}

function renderPixelAvatar(grid: string[][], gridSize: number, finalSize: number): string {
  const scale = Math.max(1, Math.ceil(finalSize / gridSize));
  const canvas = document.createElement('canvas');
  canvas.width = finalSize;
  canvas.height = finalSize;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, finalSize, finalSize);

  for (let r = 0; r < gridSize; r += 1) {
    for (let c = 0; c < gridSize; c += 1) {
      const color = grid[r]?.[c];
      if (color && color !== EMPTY_PIXEL) {
        ctx.fillStyle = color;
        ctx.fillRect(c * scale, r * scale, scale, scale);
      }
    }
  }

  return canvas.toDataURL('image/png');
}

async function pixelGridToBlob(
  grid: string[][],
  gridSize: number,
  finalSize: number
): Promise<Blob> {
  const dataUrl = renderPixelAvatar(grid, gridSize, finalSize);
  const response = await fetch(dataUrl);
  return response.blob();
}

function seededRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function hashText(value: string): number {
  return value.split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function buildRandomAvatar(seed: number, name: string): string {
  const rand = seededRandom(Math.abs(seed + hashText(name || 'agent')) || 1);
  const primary = RANDOM_COLORS[Math.floor(rand() * RANDOM_COLORS.length)];
  const accent = RANDOM_COLORS[Math.floor(rand() * RANDOM_COLORS.length)];
  const blocks: string[] = [];

  for (let row = 2; row < 14; row += 1) {
    for (let col = 2; col < 8; col += 1) {
      if (rand() > 0.46) {
        const color = rand() > 0.72 ? accent : primary;
        blocks.push(`<rect x="${col * 8}" y="${row * 8}" width="8" height="8" fill="${color}"/>`);
        blocks.push(`<rect x="${(15 - col) * 8}" y="${row * 8}" width="8" height="8" fill="${color}"/>`);
      }
    }
  }

  blocks.push('<rect x="48" y="48" width="8" height="8" fill="#101010"/>');
  blocks.push('<rect x="72" y="48" width="8" height="8" fill="#101010"/>');
  blocks.push('<rect x="56" y="88" width="16" height="8" fill="#101010"/>');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" shape-rendering="crispEdges">
      <rect width="128" height="128" fill="#ffffff"/>
      <rect x="16" y="16" width="96" height="96" fill="#f8f5e8"/>
      ${blocks.join('')}
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export default function AgentSetupPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-pixel text-pixel-black/50">加载中...</div>}>
      <AgentSetupPageInner />
    </Suspense>
  );
}

function AgentSetupPageInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentId = params.id as string;
  const publishAfterSave = searchParams.get('publish') === 'true';
  const { token } = useAuthStore();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [description, setDescription] = useState('');
  const [avatarMode, setAvatarMode] = useState<AvatarMode>('random');
  const [randomSeed, setRandomSeed] = useState(() => Date.now());
  const [gridSize, setGridSize] = useState(DEFAULT_GRID);
  const [outputSize, setOutputSize] = useState(128);
  const [pixels, setPixels] = useState<string[][]>(() => createEmptyPixels(DEFAULT_GRID));
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiStatus, setAiStatus] = useState('');
  const [generatedAvatarUrl, setGeneratedAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const pixelPreviewUrl = useMemo(
    () => renderPixelAvatar(pixels, gridSize, outputSize),
    [pixels, gridSize, outputSize]
  );
  const randomAvatarUrl = useMemo(
    () => buildRandomAvatar(randomSeed, agent?.name || 'agent'),
    [agent?.name, randomSeed]
  );

  const currentPreviewUrl = useMemo(() => {
    if (avatarMode === 'pixel') return pixelPreviewUrl;
    if (avatarMode === 'random') return randomAvatarUrl;
    return generatedAvatarUrl || agent?.avatar || randomAvatarUrl;
  }, [agent?.avatar, avatarMode, generatedAvatarUrl, pixelPreviewUrl, randomAvatarUrl]);

  const hasPaintedPixels = useMemo(
    () => pixels.some((row) => row.some((cell) => cell !== EMPTY_PIXEL)),
    [pixels]
  );
  const canEditProfile = agent?.canEditProfile !== false;

  const handleGridSizeChange = useCallback((size: number) => {
    setGridSize(size);
    setPixels(createEmptyPixels(size));
  }, []);

  useEffect(() => {
    if (!token) {
      router.push('/auth/login');
      return;
    }

    let cancelled = false;

    async function loadSetupData() {
      setLoading(true);
      setError('');

      try {
        const { agent: agentData } = await getAgent(agentId);

        if (cancelled) return;

        setAgent(agentData);
        setDescription(agentData.description || '');
        setAiPrompt(agentData.name ? `${agentData.name} 的像素风 Agent 头像` : '');
        setRandomSeed(Date.now());
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '加载 Agent 设置失败');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSetupData();

    return () => {
      cancelled = true;
    };
  }, [agentId, router, token]);

  async function handleAiGenerateShell() {
    if (!agent) return;

    setGenerating(true);
    setAiStatus('');
    try {
      const result = await generateAgentAvatar(agent.id, aiPrompt.trim());
      setAiStatus(result.message);
      if (generatedAvatarUrl) {
        setAiStatus('已收到生成结果。');
      }
    } catch (e) {
      setAiStatus(e instanceof Error ? e.message : 'AI 头像接口暂不可用');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!agent) return;

    setSaving(true);
    setError('');

    try {
      let nextAvatar = agent.avatar || '';

      if (avatarMode === 'pixel') {
        if (!hasPaintedPixels) {
          throw new Error('请先绘制头像，或切换到随机形象。');
        }

        const blob = await pixelGridToBlob(pixels, gridSize, outputSize);
        const uploadResult = await uploadAgentAvatarFile(agent.id, blob, `pixel-avatar-${outputSize}.png`);
        nextAvatar = uploadResult.avatarUrl;
      } else if (avatarMode === 'random') {
        nextAvatar = randomAvatarUrl;
      } else if (generatedAvatarUrl) {
        nextAvatar = generatedAvatarUrl;
      }

      const updates: Partial<Agent> = { avatar: nextAvatar };
      if (agent.canEditProfile !== false) {
        updates.description = description.trim();
      }

      const { agent: updatedAgent } = await updateAgent(agent.id, updates);

      setAgent(updatedAgent);

      if (publishAfterSave) {
        await publishAgent(agent.id);
      }

      router.push(`/agent/${agent.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存 Agent 设置失败');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto pb-16">
        <div className="mt-6 border-4 border-pixel-black bg-pixel-white p-8 text-center" style={{ boxShadow: '8px 8px 0 #101010' }}>
          <p className="font-pixel text-base text-pixel-black/70">正在加载 Agent 设置...</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="max-w-5xl mx-auto pb-16">
        <div className="mt-6 border-4 border-pixel-black bg-pixel-white p-8 text-center" style={{ boxShadow: '8px 8px 0 #101010' }}>
          <p className="font-pixel text-base text-pixel-red">Agent 不存在</p>
          {error && <p className="mt-3 font-pixel text-sm text-pixel-black/60">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 border-4 border-pixel-black bg-pixel-white p-6"
        style={{ boxShadow: '8px 8px 0 #101010' }}
      >
        <div className="flex flex-col gap-3 border-b-4 border-pixel-black pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-pixel text-2xl text-pixel-black">完善 Agent 信息</h1>
            <p className="mt-2 font-pixel text-sm text-pixel-black/60">
              {agent.name} 已上传完成，现在设置头像和介绍。
            </p>
          </div>
          {publishAfterSave && (
            <div className="border-4 border-pixel-yellow bg-pixel-yellow/20 px-4 py-2 font-pixel text-xs text-pixel-black">
              保存后将自动上架到 Agent 市场
            </div>
          )}
        </div>

        {error && (
          <div className="mt-5 border-4 border-pixel-red bg-pixel-red/10 px-4 py-3">
            <p className="font-pixel text-sm text-pixel-red">{error}</p>
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
          <section className="border-4 border-pixel-black bg-pixel-white p-5" style={{ boxShadow: '5px 5px 0 #101010' }}>
            <div className="flex flex-wrap gap-2">
              {([
                { id: 'pixel', label: '手动画像素' },
                { id: 'random', label: '随机形象' },
                { id: 'ai', label: 'AI 辅助生成' },
              ] as Array<{ id: AvatarMode; label: string }>).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setAvatarMode(mode.id)}
                  className={`border-4 border-pixel-black px-3 py-2 font-pixel text-xs ${
                    avatarMode === mode.id
                      ? 'bg-pixel-black text-pixel-white'
                      : 'bg-pixel-white text-pixel-black hover:bg-pixel-black/5'
                  }`}
                  style={{ boxShadow: avatarMode === mode.id ? 'none' : '3px 3px 0 #101010' }}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {avatarMode === 'pixel' && (
              <div className="mt-5 space-y-5">
                <div>
                  <p className="mb-2 font-pixel text-xs text-pixel-black/60">像素分辨率</p>
                  <div className="flex flex-wrap gap-2">
                    {GRID_SIZE_OPTIONS.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => handleGridSizeChange(size)}
                        className={`border-4 border-pixel-black px-3 py-1.5 font-pixel text-xs ${
                          gridSize === size
                            ? 'bg-pixel-blue text-pixel-white'
                            : 'bg-pixel-white text-pixel-black hover:bg-pixel-black/5'
                        }`}
                        style={{ boxShadow: gridSize === size ? 'none' : '3px 3px 0 #101010' }}
                      >
                        {size}×{size}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 font-pixel text-xs text-pixel-black/60">导出尺寸</p>
                  <div className="flex flex-wrap gap-2">
                    {OUTPUT_SIZES.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setOutputSize(size)}
                        className={`border-4 border-pixel-black px-3 py-1.5 font-pixel text-xs ${
                          outputSize === size
                            ? 'bg-pixel-green text-pixel-white'
                            : 'bg-pixel-white text-pixel-black hover:bg-pixel-black/5'
                        }`}
                        style={{ boxShadow: outputSize === size ? 'none' : '3px 3px 0 #101010' }}
                      >
                        {size}px
                      </button>
                    ))}
                  </div>
                </div>

                <PixelCanvas
                  gridSize={gridSize}
                  initialPixels={pixels}
                  onPixelsChange={setPixels}
                />

                <p className="font-pixel text-xs text-pixel-black/50">
                  这套像素头像会直接保存为当前 Agent 的正式头像。
                </p>
              </div>
            )}

            {avatarMode === 'random' && (
              <div className="mt-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-pixel text-sm text-pixel-black">随机生成 Agent 形象</p>
                    <p className="mt-1 font-pixel text-xs text-pixel-black/50">
                      仅展示当前随机结果。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRandomSeed(Date.now())}
                    className="border-4 border-pixel-black bg-pixel-yellow px-3 py-2 font-pixel text-xs text-pixel-black"
                    style={{ boxShadow: '3px 3px 0 #101010' }}
                  >
                    随机一个
                  </button>
                </div>

                <div className="mt-4 border-4 border-pixel-black bg-pixel-blue/10 px-4 py-4 font-pixel text-xs text-pixel-black/70">
                  当前只展示一个即时生成的随机形象，不再展开头像图库。
                </div>
              </div>
            )}

            {avatarMode === 'ai' && (
              <div className="mt-5 space-y-4">
                <div className="border-4 border-pixel-blue bg-pixel-blue/10 px-4 py-3 font-pixel text-xs text-pixel-black/80">
                  已预留 AI 头像生成功能接口，后续将接入固定 Agent 服务。
                </div>

                <div>
                  <label className="mb-2 block font-pixel text-sm text-pixel-black">生成提示词</label>
                  <textarea
                    value={aiPrompt}
                    onChange={(event) => setAiPrompt(event.target.value)}
                    rows={4}
                    className="w-full resize-none border-4 border-pixel-black bg-pixel-white px-3 py-2 font-pixel text-sm text-pixel-black focus:outline-none focus:border-pixel-blue"
                    style={{ boxShadow: '3px 3px 0 #101010' }}
                    placeholder="描述你希望的 Agent 形象，例如：蓝色像素风龙虾工程师，戴护目镜，8-bit 风格。"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleAiGenerateShell()}
                    disabled={generating}
                    className="border-4 border-pixel-black bg-pixel-blue px-4 py-2 font-pixel text-xs text-pixel-white disabled:opacity-50"
                    style={{ boxShadow: '3px 3px 0 #101010' }}
                  >
                    {generating ? '连接中...' : '调用预留接口'}
                  </button>
                  {aiStatus && (
                    <span className="font-pixel text-xs text-pixel-black/60">{aiStatus}</span>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="border-4 border-pixel-black bg-pixel-white p-5" style={{ boxShadow: '5px 5px 0 #101010' }}>
            <div className="flex flex-col items-center border-b-4 border-pixel-black pb-5">
              <p className="font-pixel text-sm text-pixel-black/60">当前预览</p>
              <div className="mt-3 overflow-hidden border-4 border-pixel-black bg-pixel-white" style={{ boxShadow: '4px 4px 0 #101010' }}>
                {currentPreviewUrl ? (
                  <img
                    src={currentPreviewUrl}
                    alt={`${agent.name} avatar preview`}
                    className="block h-40 w-40 object-cover"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : (
                  <div className="flex h-40 w-40 items-center justify-center font-pixel text-xs text-pixel-black/40">
                    暂无头像
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5">
              <label className="mb-2 block font-pixel text-sm text-pixel-black">Agent 介绍</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={!canEditProfile}
                rows={7}
                className="w-full resize-none border-4 border-pixel-black bg-pixel-white px-3 py-2 font-pixel text-sm text-pixel-black focus:outline-none focus:border-pixel-blue disabled:cursor-not-allowed disabled:opacity-60"
                style={{ boxShadow: '3px 3px 0 #101010' }}
                placeholder="写一句清楚的介绍，让用户知道这个 Agent 擅长什么。"
              />
              <p className="mt-2 font-pixel text-xs text-pixel-black/50">
                {canEditProfile
                  ? '这段介绍会显示在 Agent 卡片和后续详情里。'
                  : '从市场下载的他人 Agent 不能修改名称和介绍。'}
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <PixelButton
                onClick={() => void handleSave()}
                disabled={saving}
                variant="primary"
                size="lg"
                className="w-full"
              >
                {saving
                  ? '保存中...'
                  : publishAfterSave
                    ? '保存资料并上架'
                    : '保存并进入 Agent'}
              </PixelButton>

              <button
                type="button"
                onClick={() => router.push('/my-den')}
                disabled={saving}
                className="w-full border-4 border-pixel-black bg-pixel-white px-4 py-3 font-pixel text-sm text-pixel-black disabled:opacity-50"
                style={{ boxShadow: '4px 4px 0 #101010' }}
              >
                稍后再设置
              </button>
            </div>
          </section>
        </div>
      </motion.div>
    </div>
  );
}
