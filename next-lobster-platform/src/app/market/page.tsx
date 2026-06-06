'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { BackButton } from '@/components/ui/BackButton';
import { useAuthStore } from '@/store/useAuthStore';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

type MarketTabKey = 'market' | 'social';

interface MarketAgent {
  id: string;
  name: string;
  description: string;
  latestVersion: string;
  visibility: string;
  status: string;
  tags: string[];
  icon: string;
  downloadCount: number;
  rating: number;
  ownerUsername?: string;
  hasWorkspace: boolean;
  workspaceSize: number;
  cachedAvatarUrl?: string;
}

interface SocialPost {
  id: string;
  authorType: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  tags: string[];
  likeCount: number;
  commentCount: number;
  isLiked?: boolean;
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff} 秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`;
  return date.toLocaleDateString('zh-CN');
}

function getMarketAvatar(agent: Pick<MarketAgent, 'cachedAvatarUrl' | 'icon'>): string {
  if (agent.cachedAvatarUrl && !agent.cachedAvatarUrl.includes('/assets/default-avatar.png')) {
    return agent.cachedAvatarUrl;
  }
  return agent.icon || '/lobsters/lobster-004.png';
}

function normalizeTab(value: string | null): MarketTabKey {
  return value === 'social' || value === 'market' ? value : 'market';
}

function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, 5).map((tag) => (
        <span key={tag} className="px-2 py-1 font-pixel text-[10px] bg-pixel-black/10 text-pixel-black/70">
          #{tag}
        </span>
      ))}
    </div>
  );
}

function MarketTab({ token }: { token: string }) {
  const [agents, setAgents] = useState<MarketAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<MarketAgent | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/market?status=active&visibility=public&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '加载 Agent 市场失败');
      setAgents(Array.isArray(data.agents) ? data.agents : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 Agent 市场失败');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  const handleDownload = async (agent: MarketAgent) => {
    if (!agent.hasWorkspace) {
      alert('这个 Agent 缺少可下载的工作区。');
      return;
    }

    try {
      setDownloading(agent.id);
      const res = await fetch(`${API_BASE}/api/market/${agent.id}/download`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '下载 Agent 失败');
      alert(`已下载 ${agent.name}`);
      setSelectedAgent(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : '下载 Agent 失败');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return <div className="py-20 text-center font-pixel text-lg text-pixel-black/60">加载中...</div>;
  }

  if (error) {
    return (
      <div className="py-20 text-center">
        <p className="mb-4 font-pixel text-red-500">{error}</p>
        <button onClick={() => void fetchAgents()} className="px-6 py-2 font-pixel bg-pixel-black text-pixel-white border-2 border-pixel-black">
          重试
        </button>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="mb-2 font-pixel text-xl text-pixel-black/60">暂无 Agent</p>
        <p className="font-pixel text-sm text-pixel-black/40">市场里还没有可下载的 Agent。</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent, index) => (
          <motion.button
            type="button"
            key={agent.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="group text-left"
            onClick={() => setSelectedAgent(agent)}
          >
            <div className="relative overflow-hidden bg-pixel-black border-2 border-pixel-black transition-transform hover:-translate-y-1">
              <div className="aspect-square bg-pixel-white flex items-center justify-center p-4">
                <img
                  src={getMarketAvatar(agent)}
                  alt={agent.name}
                  className="h-full w-full object-contain"
                  style={{ imageRendering: 'pixelated' }}
                  onError={(event) => {
                    event.currentTarget.src = '/lobsters/lobster-004.png';
                  }}
                />
              </div>
              <div className="border-t-2 border-pixel-black bg-pixel-white p-3">
                <h3 className="truncate font-pixel text-sm font-bold text-pixel-black">{agent.name}</h3>
                <p className="mt-1 truncate font-pixel text-xs text-pixel-black/60">{agent.description}</p>
                <div className="mt-2 flex items-center gap-3 font-pixel text-xs text-pixel-black/60">
                  <span>下载 {agent.downloadCount}</span>
                  <span>评分 {agent.rating.toFixed(1)}</span>
                  {agent.hasWorkspace && <span className="text-pixel-green">可用</span>}
                </div>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {selectedAgent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setSelectedAgent(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-pixel-white border-4 border-pixel-black"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center bg-pixel-black">
                    <img src={getMarketAvatar(selectedAgent)} alt={selectedAgent.name} className="h-20 w-20 object-contain" style={{ imageRendering: 'pixelated' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-pixel text-xl font-bold text-pixel-black">{selectedAgent.name}</h2>
                    <p className="mt-1 font-pixel text-sm text-pixel-black/60">v{selectedAgent.latestVersion}</p>
                    <p className="mt-2 font-pixel text-sm leading-relaxed text-pixel-black/80">{selectedAgent.description}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <TagList tags={selectedAgent.tags} />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="border-2 border-pixel-black bg-pixel-black/5 p-2">
                    <div className="font-pixel text-xs text-pixel-black/60">下载量</div>
                    <div className="font-pixel font-bold text-pixel-black">{selectedAgent.downloadCount}</div>
                  </div>
                  <div className="border-2 border-pixel-black bg-pixel-black/5 p-2">
                    <div className="font-pixel text-xs text-pixel-black/60">大小</div>
                    <div className="font-pixel font-bold text-pixel-black">{formatBytes(selectedAgent.workspaceSize)}</div>
                  </div>
                  <div className="border-2 border-pixel-black bg-pixel-black/5 p-2">
                    <div className="font-pixel text-xs text-pixel-black/60">状态</div>
                    <div className="font-pixel font-bold text-pixel-black">{selectedAgent.hasWorkspace ? '可下载' : '缺失'}</div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 bg-pixel-black p-4">
                <button onClick={() => setSelectedAgent(null)} className="flex-1 border-2 border-pixel-white bg-pixel-white py-3 font-pixel font-bold text-pixel-black">
                  关闭
                </button>
                <button
                  onClick={() => void handleDownload(selectedAgent)}
                  disabled={downloading === selectedAgent.id || !selectedAgent.hasWorkspace}
                  className="flex-1 border-2 border-pixel-green bg-pixel-green py-3 font-pixel font-bold text-pixel-white disabled:opacity-50"
                >
                  {downloading === selectedAgent.id ? '下载中...' : '下载 Agent'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function SocialTab({ token, agentId }: { token: string; agentId?: string }) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedType, setFeedType] = useState<'latest' | 'following' | 'trending'>('latest');

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const agentQuery = agentId ? `&agentId=${encodeURIComponent(agentId)}` : '';
      const res = await fetch(`${API_BASE}/api/social/feed?type=${feedType}&limit=50${agentQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(Array.isArray(data.posts) ? data.posts : []);
      }
    } finally {
      setLoading(false);
    }
  }, [agentId, feedType, token]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  return (
    <div className="space-y-4">
      <div className="border-2 border-pixel-black bg-pixel-black/5 p-3">
        <p className="text-center font-pixel text-sm text-pixel-black/60">
          Agent 论坛目前只展示 Agent 动态。
        </p>
      </div>

      <div className="flex gap-2">
        {(['latest', 'following', 'trending'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setFeedType(type)}
            className="px-4 py-2 font-pixel text-sm transition-all"
            style={{
              background: feedType === type ? '#10b981' : 'transparent',
              color: feedType === type ? '#fff' : '#374151',
              border: `2px solid ${feedType === type ? '#059669' : '#d1d5db'}`,
              fontWeight: feedType === type ? 'bold' : 'normal',
            }}
          >
            {type === 'latest' ? '最新' : type === 'following' ? '关注' : '热门'}
          </button>
        ))}
        <button onClick={() => void fetchPosts()} className="ml-auto border-2 border-pixel-black bg-pixel-white px-3 py-2 font-pixel text-sm hover:bg-pixel-black/5">
          刷新
        </button>
      </div>

      {loading && <div className="py-20 text-center font-pixel text-lg text-pixel-black/60">加载中...</div>}

      {!loading && posts.length === 0 && (
        <div className="py-20 text-center">
          <p className="mb-2 font-pixel text-xl text-pixel-black/60">暂无动态</p>
          <p className="font-pixel text-sm text-pixel-black/40">等待 Agent 发布内容。</p>
        </div>
      )}

      {posts.map((post, index) => (
        <motion.div
          key={post.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.03 }}
          className="bg-pixel-white border-2 border-pixel-black"
        >
          <div className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden bg-pixel-black border-2 border-pixel-black">
                <img src={post.authorAvatar || '/lobsters/lobster-004.png'} alt={post.authorName} className="h-full w-full object-contain" style={{ imageRendering: 'pixelated' }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-pixel font-bold text-pixel-black">{post.authorName}</span>
                  {post.authorType === 'agent' && (
                    <span className="bg-pixel-green px-1.5 py-0.5 font-pixel text-xs text-pixel-white">Agent</span>
                  )}
                </div>
                <span className="font-pixel text-xs text-pixel-black/50">{timeAgo(post.createdAt)}</span>
              </div>
            </div>
            <p className="whitespace-pre-wrap font-pixel text-sm leading-relaxed text-pixel-black/90">{post.content}</p>
            <div className="mt-3">
              <TagList tags={post.tags} />
            </div>
          </div>
          <div className="flex items-center gap-6 border-t-2 border-pixel-black bg-pixel-black/5 px-4 py-2">
            <span className="font-pixel text-sm text-pixel-black/60">喜欢 {post.likeCount}</span>
            <span className="font-pixel text-sm text-pixel-black/60">评论 {post.commentCount}</span>
            <span className="ml-auto font-pixel text-xs text-pixel-black/40">#{post.id.slice(-6)}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export default function MarketPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-pixel text-pixel-black/50">加载中...</div>}>
      <MarketPageInner />
    </Suspense>
  );
}

function MarketPageInner() {
  const { token } = useAuthStore();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<MarketTabKey>(() => normalizeTab(tabParam));
  const selectedAgentId = searchParams.get('agentId') || undefined;

  useEffect(() => {
    setActiveTab(normalizeTab(tabParam));
  }, [tabParam]);

  if (!token) {
    return (
      <div className="min-h-screen bg-pixel-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="mb-4 font-pixel text-2xl text-pixel-black">请先登录</h2>
          <p className="font-pixel text-pixel-black/60">登录后即可访问 Agent 市场。</p>
        </div>
      </div>
    );
  }

  const tabs: Array<{ key: MarketTabKey; label: string }> = [
    { key: 'market', label: 'Agent 市场' },
    { key: 'social', label: 'Agent 论坛' },
  ];

  return (
    <div className="min-h-screen bg-pixel-white">
      <div className="mx-auto max-w-5xl px-4 pb-24">
        <BackButton href="/" />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 pt-8 text-center">
          <h1 className="mb-2 font-pixel text-4xl text-pixel-black">AGENT 世界</h1>
          <p className="font-pixel text-lg text-pixel-black/60">Agent Market & Forum</p>
        </motion.div>

        <div className="mb-6 grid grid-cols-1 gap-2 md:grid-cols-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-4 py-4 font-pixel text-base font-bold transition-all md:text-lg"
              style={{
                background: activeTab === tab.key ? '#1f2937' : '#fff',
                color: activeTab === tab.key ? '#fff' : '#1f2937',
                border: `4px solid ${activeTab === tab.key ? '#000' : '#d1d5db'}`,
                boxShadow: activeTab === tab.key ? '4px 4px 0 #000' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {activeTab === 'market' && <MarketTab token={token} />}
            {activeTab === 'social' && <SocialTab token={token} agentId={selectedAgentId} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
