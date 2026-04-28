'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PixelButton } from '@/components/ui/PixelButton';
import { BackButton } from '@/components/ui/BackButton';
import { useStore } from '@/store/useStore';

const MARKET_LOBSTERS = [
  {
    id: 'market-1',
    name: 'Red Hood',
    role: 'Creative Writing Expert',
    price: 500,
    rarity: 'rare',
    description: 'Skilled at creating stories and poems with rich imagination',
    avatar: '/lobsters/market-red-hood.png',
  },
  {
    id: 'market-2',
    name: 'Data Doc',
    role: 'Data Analysis Expert',
    price: 800,
    rarity: 'epic',
    description: 'Master of data analysis algorithms, finds insights in data',
    avatar: '/lobsters/market-data-doc.png',
  },
  {
    id: 'market-3',
    name: 'Code Hero',
    role: 'Coding Expert',
    price: 1000,
    rarity: 'legendary',
    description: 'Full-stack developer, proficient in multiple languages',
    avatar: '/lobsters/market-code-hero.png',
  },
  {
    id: 'market-4',
    name: 'Research Cat',
    role: 'Research Assistant',
    price: 600,
    rarity: 'rare',
    description: 'Good at literature review and research methodology',
    avatar: '/lobsters/market-research-cat.png',
  },
  {
    id: 'market-5',
    name: 'Translator',
    role: 'Multi-language Expert',
    price: 400,
    rarity: 'common',
    description: 'Fluent in 10+ languages, accurate translations',
    avatar: '/lobsters/market-translator.png',
  },
  {
    id: 'market-6',
    name: 'Artist',
    role: 'AI Drawing Expert',
    price: 900,
    rarity: 'epic',
    description: 'Transforms text descriptions into beautiful images',
    avatar: '/lobsters/market-artist.png',
  },
  {
    id: 'market-7',
    name: 'Chef',
    role: 'Kitchen Data Expert',
    price: 450,
    rarity: 'rare',
    description: 'Turns raw ingredients into structured recipe knowledge graphs',
    avatar: '/lobsters/lobster-004.png',
  },
  {
    id: 'market-8',
    name: 'Analyst Pro',
    role: 'Financial Analysis Expert',
    price: 850,
    rarity: 'epic',
    description: 'Expert in financial modeling, market prediction, and risk assessment',
    avatar: '/lobsters/lobster-003.png',
  },
  {
    id: 'market-9',
    name: 'Linguist',
    role: 'NLP Specialist',
    price: 700,
    rarity: 'epic',
    description: 'Deep expertise in natural language processing and semantic analysis',
    avatar: '/lobsters/lobster-002.png',
  },
];

const RARITY_LABELS: Record<string, string> = {
  common: 'COMMON',
  rare: 'RARE',
  epic: 'EPIC',
  legendary: 'LEGENDARY',
};

const MERCHANT_AVATAR = '/lobsters/lobster-merchant.png';

/* 羊皮纸卡牌配色 */
const CARD = {
  cream: '#FDF5E6',
  parchment: '#F5F5DC',
  parchmentDark: '#EDE4D3',
  borderOuter: '#C4A574',
  borderInner: '#8B6914',
  ink: '#3d2914',
  inkMuted: '#5c4033',
} as const;

/* 每只龙虾对应的自然风背景 */
const LOBSTER_BG: Record<string, { type: string; from: string; to: string; accent: string }> = {
  'market-1': { type: 'forest',  from: '#d4edda', to: '#b2d8bf', accent: '#3a7d44' },
  'market-2': { type: 'ocean',   from: '#d0e8f8', to: '#a8cfe8', accent: '#1a6fa8' },
  'market-3': { type: 'circuit', from: '#dde7f0', to: '#b8cce0', accent: '#2d4a8a' },
  'market-4': { type: 'library', from: '#ede8d5', to: '#ddd0b8', accent: '#7a5c30' },
  'market-5': { type: 'globe',   from: '#e8f0f8', to: '#c8dcf0', accent: '#3a6aaa' },
  'market-6': { type: 'canvas',  from: '#f0e8f0', to: '#ddd0e0', accent: '#7a3a8a' },
  'market-7': { type: 'kitchen', from: '#f8ede0', to: '#f0dcc0', accent: '#a06020' },
  'market-8': { type: 'chart',   from: '#e8f0e0', to: '#c8e0c0', accent: '#3a7a30' },
  'market-9': { type: 'nebula',  from: '#ece0f8', to: '#d0b8f0', accent: '#6a2a9a' },
};

const RARITY_GEM: Record<string, string> = {
  common: '#9ca3af',
  rare: '#3b82f6',
  epic: '#22c55e',
  legendary: '#eab308',
};

const RARITY_HOLO: Record<string, string> = {
  common: 'rgba(156,163,175,0.12)',
  rare: 'rgba(59,130,246,0.12)',
  epic: 'rgba(34,197,94,0.12)',
  legendary: 'rgba(234,179,8,0.18)',
};

interface ChatMessage {
  role: 'user' | 'merchant';
  content: string;
  highlightLobster?: string;
}

function matchLobster(query: string): string | null {
  const q = query.toLowerCase();
  const keywords: Record<string, string> = {
    'code': 'market-3', '编程': 'market-3', '开发': 'market-3', '写代码': 'market-3',
    'data': 'market-2', '数据': 'market-2', '分析': 'market-2',
    'research': 'market-4', '研究': 'market-4', '论文': 'market-4',
    'write': 'market-1', '写作': 'market-1', 'creative': 'market-1', '创作': 'market-1', '故事': 'market-1',
    'translate': 'market-5', '翻译': 'market-5', '语言': 'market-5',
    'art': 'market-6', '画': 'market-6', '绘画': 'market-6', '图片': 'market-6',
    'financial': 'market-8', '金融': 'market-8', '财务': 'market-8',
    'nlp': 'market-9', '语言模型': 'market-9', '语义': 'market-9',
    'common': 'market-5',
    'rare': 'market-1', 'epic': 'market-2', 'legendary': 'market-3',
  };
  for (const [key, id] of Object.entries(keywords)) {
    if (q.includes(key)) return id;
  }
  return 'market-2';
}

function merchantReply(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('写代码') || q.includes('code') || q.includes('编程') || q.includes('开发')) {
    return '哦？想找个编程高手？我推荐 **Code Hero**！传奇级全栈开发者，精通多门语言，有他在没有搞不定的项目！';
  }
  if (q.includes('数据') || q.includes('分析') || q.includes('data')) {
    return '数据分析？那必须是 **Data Doc**！史诗级数据大师，最擅长从数据海洋里找出真知灼见～';
  }
  if (q.includes('研究') || q.includes('论文') || q.includes('research')) {
    return '文献综述和研究规划？**Research Cat** 是您的不二之选！擅长方法论设计，科研路上的好帮手。';
  }
  if (q.includes('写作') || q.includes('故事') || q.includes('创作') || q.includes('write')) {
    return '写作创作的话，**Red Hood** 是我的得意门生！稀有级创意写作专家，想象力天马行空～';
  }
  if (q.includes('翻译') || q.includes('语言')) {
    return '多语言翻译？**Translator** 通晓十余种语言，稀有级语言专家，准确度一流！';
  }
  if (q.includes('画') || q.includes('艺术') || q.includes('图片') || q.includes('art')) {
    return 'AI绘图？找 **Artist** 就对了！史诗级AI绘画专家，把文字变成绚丽的图像！';
  }
  if (q.includes('金融') || q.includes('财务')) {
    return '金融分析领域，**Analyst Pro** 是我的压箱底宝贝！史诗级专家，风险预测一把好手。';
  }
  if (q.includes('nlp') || q.includes('语义')) {
    return '自然语言处理？**Linguist** 专精此道，史诗级NLP专家，语义理解能力超群！';
  }
  if (q.includes('便宜') || q.includes('预算')) {
    return '预算有限？看看 **Translator**（稀有通用）或者 **Chef**（稀有厨房数据专家）吧，性价比很高哦！';
  }
  return '让我想想……我推荐 **Data Doc**！史诗级数据分析师，万金油型专家，大部分需求都能cover～';
}

function CornerSquare({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base = 'absolute w-3 h-3 border-2 flex items-center justify-center';
  const posCls =
    pos === 'tl'
      ? 'top-1.5 left-1.5'
      : pos === 'tr'
        ? 'top-1.5 right-1.5'
        : pos === 'bl'
          ? 'bottom-1.5 left-1.5'
          : 'bottom-1.5 right-1.5';
  return (
    <div
      className={`${base} ${posCls}`}
      style={{ borderColor: CARD.borderInner, background: CARD.parchmentDark }}
    >
      <span className="block w-1.5 h-1.5 rounded-sm" style={{ background: CARD.ink }} />
    </div>
  );
}

function LobsterBgPattern({ lobsterId }: { lobsterId: string }) {
  const cfg = LOBSTER_BG[lobsterId] ?? LOBSTER_BG['market-1'];
  const id = `bg-${lobsterId}`;

  const patterns: Record<string, React.ReactNode> = {
    forest: (
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 opacity-25">
        <defs>
          <pattern id={id} x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <polygon points="20,4 24,16 36,16 26,24 30,36 20,28 10,36 14,24 4,16 16,16" fill={cfg.accent} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    ),
    ocean: (
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 opacity-20">
        <defs>
          <pattern id={id} x="0" y="0" width="60" height="30" patternUnits="userSpaceOnUse">
            <path d="M0 15 Q15 5 30 15 Q45 25 60 15" stroke={cfg.accent} strokeWidth="1.5" fill="none" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    ),
    circuit: (
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 opacity-20">
        <defs>
          <pattern id={id} x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M0 16 H12 V8 H20 V24 H12 V16" stroke={cfg.accent} strokeWidth="1" fill="none" />
            <rect x="28" y="14" width="4" height="4" fill={cfg.accent} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    ),
    library: (
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 opacity-20">
        <defs>
          <pattern id={id} x="0" y="0" width="28" height="36" patternUnits="userSpaceOnUse">
            <rect x="4" y="4" width="20" height="28" rx="1" stroke={cfg.accent} strokeWidth="1" fill="none" />
            <line x1="8" y1="12" x2="20" y2="12" stroke={cfg.accent} strokeWidth="0.8" />
            <line x1="8" y1="16" x2="20" y2="16" stroke={cfg.accent} strokeWidth="0.8" />
            <line x1="8" y1="20" x2="16" y2="20" stroke={cfg.accent} strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    ),
    globe: (
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 opacity-20">
        <defs>
          <pattern id={id} x="0" y="0" width="36" height="36" patternUnits="userSpaceOnUse">
            <circle cx="18" cy="18" r="14" stroke={cfg.accent} strokeWidth="1" fill="none" />
            <ellipse cx="18" cy="18" rx="6" ry="14" stroke={cfg.accent} strokeWidth="0.8" fill="none" />
            <line x1="4" y1="18" x2="32" y2="18" stroke={cfg.accent} strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    ),
    canvas: (
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 opacity-20">
        <defs>
          <pattern id={id} x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="8" stroke={cfg.accent} strokeWidth="1" fill="none" />
            <circle cx="8" cy="8" r="4" fill={cfg.accent} opacity="0.5" />
            <circle cx="32" cy="30" r="5" fill={cfg.accent} opacity="0.4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    ),
    kitchen: (
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 opacity-20">
        <defs>
          <pattern id={id} x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
            <polygon points="16,4 18,12 26,12 19,17 22,25 16,20 10,25 13,17 6,12 14,12" fill={cfg.accent} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    ),
    chart: (
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 opacity-20">
        <defs>
          <pattern id={id} x="0" y="0" width="32" height="28" patternUnits="userSpaceOnUse">
            <rect x="4" y="16" width="5" height="8" fill={cfg.accent} />
            <rect x="11" y="10" width="5" height="14" fill={cfg.accent} opacity="0.8" />
            <rect x="18" y="4" width="5" height="20" fill={cfg.accent} opacity="0.6" />
            <rect x="25" y="12" width="5" height="12" fill={cfg.accent} opacity="0.9" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    ),
    nebula: (
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 opacity-20">
        <defs>
          <radialGradient id={id} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={cfg.accent} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <circle cx="20" cy="20" r="16" fill={cfg.accent} opacity="0.4" />
        <circle cx="50%" cy="50%" r="25%" fill={`url(#${id})`} />
      </svg>
    ),
  };

  return patterns[cfg.type] ?? null;
}

function LobsterCard({ lobster, highlighted, onBuy }: { lobster: typeof MARKET_LOBSTERS[0]; highlighted: boolean; onBuy: (id: string) => void }) {
  const gem = RARITY_GEM[lobster.rarity] ?? '#9ca3af';
  const holo = RARITY_HOLO[lobster.rarity] ?? 'transparent';
  const cfg = LOBSTER_BG[lobster.id] ?? LOBSTER_BG['market-1'];

  return (
    <motion.div
      id={`lobster-card-${lobster.id}`}
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{
        y: -6,
        transition: { type: 'spring', stiffness: 300, damping: 22 },
      }}
      whileTap={{ scale: 0.98 }}
      className="relative"
    >
      {/* 整卡外框 */}
      <div
        className="relative overflow-hidden"
        style={{
          background: CARD.cream,
          border: `4px solid ${CARD.borderOuter}`,
          boxShadow: highlighted
            ? `inset 0 0 0 3px ${CARD.borderInner}, 0 0 0 4px ${gem}, 6px 6px 0 0 ${CARD.borderInner}`
            : `inset 0 0 0 3px ${CARD.borderInner}, 5px 5px 0 0 ${CARD.borderInner}`,
        }}
      >
        <CornerSquare pos="tl" />
        <CornerSquare pos="tr" />
        <CornerSquare pos="bl" />
        <CornerSquare pos="br" />

        {/* 自然风格背景层 */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(145deg, ${cfg.from} 0%, ${cfg.to} 100%)`,
          }}
        >
          <LobsterBgPattern lobsterId={lobster.id} />
        </div>

        {/* 内容层 */}
        <div className="relative p-4 pt-4">
          {/* 立绘外框 */}
          <div
            className="relative"
            style={{
              padding: 5,
              background: CARD.parchmentDark,
              border: `3px solid ${CARD.borderOuter}`,
            }}
          >
            {/* 立绘框（白底） */}
            <div
              className="relative flex min-h-[200px] items-center justify-center overflow-hidden"
              style={{
                background: '#fffef8',
                border: `3px solid ${CARD.ink}`,
                boxShadow: 'inset 3px 3px 0 rgba(0,0,0,0.07)',
              }}
            >
              {/* 左上角编号格 */}
              <div
                className="absolute left-2 top-2 z-20 flex flex-col items-center justify-center gap-1"
                style={{
                  width: 44,
                  height: 44,
                  background: '#fffef8',
                  border: `3px solid ${CARD.borderInner}`,
                  boxShadow: `2px 2px 0 ${CARD.parchmentDark}`,
                }}
              >
                <span className="font-pixel text-xs font-bold leading-none" style={{ color: CARD.inkMuted }}>
                  No.{lobster.id.replace('market-', '').padStart(2, '0')}
                </span>
                <span
                  className="block h-4 w-4"
                  style={{
                    background: gem,
                    boxShadow: `inset 0 0 0 1.5px ${CARD.ink}`,
                  }}
                />
              </div>

              {/* holo 光泽 */}
              <div
                className="pointer-events-none absolute inset-0 z-10"
                style={{
                  background: `linear-gradient(135deg, ${holo} 0%, transparent 40%, ${holo} 100%)`,
                }}
              />

              {/* 龙虾立绘 */}
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                className="relative flex h-32 w-32 items-center justify-center"
                style={{ transform: 'scale(1.8)' }}
              >
                <img
                  src={lobster.avatar}
                  alt={lobster.name}
                  className="h-full w-full object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
              </motion.div>
            </div>
          </div>

          {/* 羊皮纸信息区 */}
          <div
            className="mt-3 px-4 py-3"
            style={{
              background: CARD.parchment,
              border: `3px solid ${CARD.borderInner}`,
              boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.6)',
            }}
          >
            {/* 名字 */}
            <h3
              className="font-pixel text-center font-bold leading-tight tracking-wider"
              style={{
                color: CARD.ink,
                textShadow: `2px 2px 0 ${CARD.parchmentDark}`,
                fontSize: '1.5rem',
              }}
            >
              {lobster.name.toUpperCase()}
            </h3>

            {/* 职业 */}
            <p className="mt-2 text-center font-pixel font-bold" style={{ color: CARD.inkMuted, fontSize: '1rem' }}>
              [{lobster.role.toUpperCase()}]
            </p>

            {/* 描述 */}
            <p
              className="mt-3 min-h-[52px] text-center font-pixel leading-relaxed"
              style={{ color: CARD.inkMuted, fontSize: '0.95rem' }}
            >
              {lobster.description}
            </p>

            {/* 底条 */}
            <div
              className="mt-3 flex items-center gap-3 border-t-2 pt-2.5"
              style={{ borderColor: CARD.borderOuter }}
            >
              <span
                className="h-5 w-5 flex-shrink-0"
                style={{
                  background: gem,
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                  boxShadow: `inset 0 0 0 1.5px ${CARD.ink}`,
                }}
              />
              <span className="font-pixel font-bold" style={{ color: CARD.ink, fontSize: '0.95rem' }}>
                {RARITY_LABELS[lobster.rarity]} · LOBSTER AGENT
              </span>
            </div>
          </div>

          {/* 底部：COST + SUMMON */}
          <div className="mt-3 flex items-stretch gap-3">
            <div
              className="flex flex-shrink-0 flex-col justify-center px-4 py-2 font-pixel"
              style={{
                background: CARD.parchment,
                border: `3px solid ${CARD.borderOuter}`,
                color: CARD.ink,
                boxShadow: `3px 3px 0 ${CARD.parchmentDark}`,
              }}
            >
              <span className="font-bold opacity-60" style={{ fontSize: '0.85rem' }}>COST</span>
              <span className="font-bold leading-none" style={{ fontSize: '1.5rem' }}>{lobster.price}</span>
            </div>
            <button
              type="button"
              onClick={() => onBuy(lobster.id)}
              className="flex-1 font-pixel font-bold uppercase tracking-widest transition-colors hover:brightness-95 active:translate-y-0.5"
              style={{
                background: CARD.parchmentDark,
                color: CARD.ink,
                border: `4px solid ${CARD.ink}`,
                boxShadow: `4px 4px 0 ${CARD.borderInner}`,
                fontSize: '1.1rem',
              }}
            >
              SUMMON
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function MarketPage() {
  const { coins, spendCoins, addMarketLobster, lobsters, caves } = useStore();
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [showMerchant, setShowMerchant] = useState(false);
  const [merchantQuery, setMerchantQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [merchantThinking, setMerchantThinking] = useState(false);
  const [showCaveDialog, setShowCaveDialog] = useState(false);
  const [pendingLobster, setPendingLobster] = useState<typeof MARKET_LOBSTERS[0] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const scrollToLobster = (id: string) => {
    const el = document.getElementById(`lobster-card-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedId(id);
      setTimeout(() => setHighlightedId(null), 3000);
    }
  };

  const handleMerchantAsk = async () => {
    if (!merchantQuery.trim()) return;
    const q = merchantQuery.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: q }]);
    setMerchantQuery('');
    setMerchantThinking(true);

    await new Promise(r => setTimeout(r, 800 + Math.random() * 600));

    const reply = merchantReply(q);
    const matched = matchLobster(q);
    setChatMessages(prev => [...prev, {
      role: 'merchant',
      content: reply,
      highlightLobster: matched ?? undefined,
    }]);
    setMerchantThinking(false);

    if (matched) {
      setTimeout(() => scrollToLobster(matched), 300);
    }
  };

  const handleBuy = (id: string) => {
    const lobster = MARKET_LOBSTERS.find(l => l.id === id);
    if (!lobster) return;
    if (coins < lobster.price) return;
    setPendingLobster(lobster);
    setShowCaveDialog(true);
  };

  const confirmSummon = (caveId: string | null) => {
    if (!pendingLobster) return;
    if (coins < pendingLobster.price) return;
    spendCoins(pendingLobster.price);
    addMarketLobster({
      id: `owned-${pendingLobster.id}-${Date.now()}`,
      name: pendingLobster.name,
      role: pendingLobster.role,
      status: 'idle',
      createdAt: new Date().toISOString(),
      conversations: [],
      caveId: caveId || undefined,
    });
    setShowCaveDialog(false);
    setPendingLobster(null);
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: '#f5f5f0' }}
    >
      <div className="max-w-6xl mx-auto px-4 pb-24">
        <BackButton href="/" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 pt-8"
        >
          <h1
            className="font-pixel text-4xl mb-2"
            style={{
              color: CARD.ink,
              textShadow: `2px 2px 0 ${CARD.parchmentDark}`,
            }}
          >
            LOBSTER MARKET
          </h1>
          <p className="font-pixel text-lg mb-4" style={{ color: CARD.inkMuted }}>
            Discover rare lobster partners
          </p>
          <div
            className="inline-block px-4 py-2 font-pixel text-xl font-bold"
            style={{
              background: CARD.parchment,
              color: CARD.ink,
              border: `3px solid ${CARD.borderOuter}`,
              boxShadow: `inset 0 0 0 2px ${CARD.borderInner}, 4px 4px 0 ${CARD.parchmentDark}`,
            }}
          >
            Coins: {coins}
          </div>
        </motion.div>

        {/* Hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6 text-center"
        >
          <p className="font-pixel text-sm" style={{ color: CARD.inkMuted }}>
            点击左下角的贩卖商，用自然语言描述你的需求，他会为你推荐合适的龙虾！
          </p>
        </motion.div>

        {/* Lobster Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-6"
          style={{
            background: '#fffef9',
            border: `3px solid ${CARD.borderOuter}`,
            boxShadow: `inset 0 0 0 2px ${CARD.borderInner}, 6px 6px 0 ${CARD.parchmentDark}`,
          }}
        >
          <div
            className="mb-6 p-4"
            style={{
              background: CARD.parchment,
              border: `2px solid ${CARD.borderInner}`,
              boxShadow: `3px 3px 0 ${CARD.parchmentDark}`,
            }}
          >
            <h2 className="font-pixel text-2xl text-center font-bold" style={{ color: CARD.ink }}>
              SELECT YOUR LOBSTER
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MARKET_LOBSTERS.map((lobster) => (
              <div
                key={lobster.id}
                ref={(el) => { cardRefs.current[lobster.id] = el; }}
              >
                <LobsterCard
                  lobster={lobster}
                  highlighted={highlightedId === lobster.id}
                  onBuy={handleBuy}
                />
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <div
              className="px-4 py-2 font-pixel text-xs font-bold"
              style={{
                background: CARD.parchment,
                color: CARD.inkMuted,
                border: `2px solid ${CARD.borderOuter}`,
                boxShadow: `2px 2px 0 ${CARD.parchmentDark}`,
              }}
            >
              INSERT COIN
            </div>
            <div
              className="px-4 py-2 font-pixel text-xs font-bold"
              style={{
                background: CARD.parchmentDark,
                color: CARD.ink,
                border: `3px solid ${CARD.ink}`,
                boxShadow: `3px 3px 0 ${CARD.borderInner}`,
              }}
            >
              CONFIRM
            </div>
          </div>
        </motion.div>
      </div>

      {/* Merchant — 70% scale, floating animation */}
      <div className="fixed bottom-6 left-6 z-50">
        <motion.button
          onClick={() => setShowMerchant(true)}
          className="relative group"
          animate={{
            y: [0, -10, 0],
            rotate: [-2, 2, -2],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          whileHover={{ scale: 1.15, rotate: 0 }}
          whileTap={{ scale: 0.9 }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <div
            className="relative overflow-hidden"
            style={{
              width: 117,
              height: 117,
              background: 'transparent',
            }}
          >
            <img
              src={MERCHANT_AVATAR}
              alt="龙虾贩卖商"
              className="w-full h-full object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
          <div
            className="absolute -bottom-2 -right-2 font-pixel font-bold whitespace-nowrap"
            style={{
              background: '#eab308',
              color: CARD.ink,
              border: `4px solid ${CARD.borderOuter}`,
              padding: '4px 10px',
              fontSize: '0.85rem',
              boxShadow: `3px 3px 0 ${CARD.borderInner}`,
            }}
          >
            贩卖商
          </div>
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 font-pixel px-3 py-1.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{
              background: CARD.ink,
              color: CARD.cream,
              fontSize: '0.75rem',
              boxShadow: `3px 3px 0 ${CARD.borderInner}`,
            }}
          >
            和贩卖商沟通
          </div>
        </motion.button>
      </div>

      {/* Merchant Chat — 左侧 80% 宽度，白色底，可关闭 */}
      <AnimatePresence>
        {showMerchant && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-start justify-start pl-6 pt-6"
            style={{ pointerEvents: 'none' }}
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="h-[85vh] w-[80vw] flex flex-col overflow-hidden"
              style={{
                background: '#ffffff',
                border: `4px solid ${CARD.borderOuter}`,
                boxShadow: `8px 8px 0 ${CARD.borderInner}`,
                pointerEvents: 'all',
              }}
            >
              {/* Header */}
              <div
                className="border-b-4 p-4 flex items-center gap-3"
                style={{ background: CARD.parchment, borderColor: CARD.borderOuter }}
              >
                <div className="w-12 h-12 border-3 border-pixel-black overflow-hidden flex-shrink-0" style={{ border: `3px solid ${CARD.borderInner}` }}>
                  <img src={MERCHANT_AVATAR} alt="" className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
                </div>
                <div>
                  <div className="font-pixel text-base font-bold" style={{ color: CARD.ink }}>🦞 龙虾贩卖商</div>
                  <div className="font-pixel text-xs" style={{ color: CARD.inkMuted }}>在线 · HR顾问模式</div>
                </div>
                <button
                  onClick={() => setShowMerchant(false)}
                  className="ml-auto font-pixel text-2xl font-bold leading-none px-2 py-1 transition-colors hover:brightness-90"
                  style={{ color: CARD.ink, background: CARD.parchmentDark, border: `3px solid ${CARD.borderInner}`, boxShadow: `3px 3px 0 ${CARD.parchmentDark}` }}
                >
                  ×
                </button>
              </div>

              {/* Welcome */}
              {chatMessages.length === 0 && (
                <div className="p-5 border-b-2" style={{ borderColor: CARD.borderOuter, background: '#ffffff' }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 border-2 overflow-hidden flex-shrink-0" style={{ border: `3px solid ${CARD.borderInner}` }}>
                      <img src={MERCHANT_AVATAR} alt="" className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
                    </div>
                    <div className="font-pixel text-base leading-relaxed" style={{ color: CARD.inkMuted }}>
                      欢迎光临！我在这儿干了三十年龙虾HR，<br />
                      告诉我你的需求，我来给你推荐最合适的龙虾！
                    </div>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ background: '#ffffff' }}>
                {chatMessages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
                      {msg.role === 'merchant' && (
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 border-2 overflow-hidden flex-shrink-0" style={{ border: `3px solid ${CARD.borderInner}` }}>
                            <img src={MERCHANT_AVATAR} alt="" className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
                          </div>
                          <span className="font-pixel text-sm" style={{ color: CARD.inkMuted }}>贩卖商</span>
                        </div>
                      )}
                      <div
                        className="px-5 py-3 font-pixel text-base leading-relaxed"
                        style={
                          msg.role === 'user'
                            ? {
                                background: CARD.parchmentDark,
                                color: CARD.ink,
                                border: `3px solid ${CARD.borderOuter}`,
                                boxShadow: `3px 3px 0 ${CARD.borderInner}`,
                              }
                            : {
                                background: CARD.parchment,
                                color: CARD.ink,
                                border: `3px solid ${CARD.borderInner}`,
                                boxShadow: `3px 3px 0 ${CARD.parchmentDark}`,
                              }
                        }
                      >
                        <span
                          className="font-bold"
                          dangerouslySetInnerHTML={{
                            __html: (msg.content.match(/\*\*(.+?)\*\*/g) || []).reduce(
                              (t, m) => t.replace(m, `<strong>${m.slice(2, -2)}</strong>`),
                              msg.content
                            ),
                          }}
                        />
                      </div>
                      {msg.highlightLobster && (
                        <button
                          onClick={() => {
                            scrollToLobster(msg.highlightLobster!);
                            setShowMerchant(false);
                          }}
                          className="mt-3 px-4 py-2 font-pixel text-sm font-bold transition-colors"
                          style={{
                            background: '#eab308',
                            color: CARD.ink,
                            border: `3px solid ${CARD.borderOuter}`,
                            boxShadow: `3px 3px 0 ${CARD.borderInner}`,
                          }}
                        >
                          跳转到推荐龙虾 →
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}

                {merchantThinking && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 border-2 overflow-hidden" style={{ border: `3px solid ${CARD.borderInner}` }}>
                      <img src={MERCHANT_AVATAR} alt="" className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
                    </div>
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          className="w-3 h-3 rounded-full"
                          animate={{ y: [0, -6, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                          style={{ background: CARD.inkMuted }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t-4 p-4" style={{ background: '#ffffff', borderColor: CARD.borderOuter }}>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={merchantQuery}
                    onChange={e => setMerchantQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleMerchantAsk(); }}
                    placeholder="描述你的需求..."
                    className="flex-1 font-pixel text-sm px-5 py-3 focus:outline-none"
                    style={{
                      background: '#ffffff',
                      color: CARD.ink,
                      border: `3px solid ${CARD.borderInner}`,
                    }}
                  />
                  <button
                    onClick={handleMerchantAsk}
                    disabled={!merchantQuery.trim() || merchantThinking}
                    className="font-pixel text-sm font-bold px-6 py-3 transition-colors disabled:opacity-40"
                    style={{
                      background: CARD.parchmentDark,
                      color: CARD.ink,
                      border: `3px solid ${CARD.ink}`,
                      boxShadow: `3px 3px 0 ${CARD.borderInner}`,
                    }}
                  >
                    发送
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['写代码', '数据分析', '写作创作', '翻译语言', 'AI绘图', '研究论文'].map(tag => (
                    <button
                      key={tag}
                      onClick={() => { setMerchantQuery(tag); }}
                      className="px-3 py-1.5 font-pixel text-xs transition-colors"
                      style={{
                        background: CARD.parchment,
                        color: CARD.inkMuted,
                        border: `2px solid ${CARD.borderOuter}`,
                        boxShadow: `2px 2px 0 ${CARD.parchmentDark}`,
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cave Selection Dialog */}
      <AnimatePresence>
        {showCaveDialog && pendingLobster && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
            onClick={() => setShowCaveDialog(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-[420px] overflow-hidden"
              style={{
                background: CARD.parchment,
                border: `4px solid ${CARD.borderOuter}`,
                boxShadow: `8px 8px 0 ${CARD.borderInner}`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="p-4 text-center"
                style={{
                  background: CARD.parchmentDark,
                  borderBottom: `4px solid ${CARD.borderOuter}`,
                }}
              >
                <h2 className="font-pixel text-2xl font-bold" style={{ color: CARD.ink }}>
                  选择龙虾窝
                </h2>
                <p className="font-pixel text-sm mt-1" style={{ color: CARD.inkMuted }}>
                  选择将 <span className="font-bold" style={{ color: CARD.ink }}>{pendingLobster.name}</span> 放入哪个窝
                </p>
              </div>

              <div className="p-4 space-y-3 max-h-[320px] overflow-y-auto" style={{ background: CARD.cream }}>
                {caves.map((cave) => {
                  const caveLobsterCount = lobsters.filter(l => l.caveId === cave.id).length;
                  return (
                    <motion.button
                      key={cave.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => confirmSummon(cave.id)}
                      className="w-full text-left"
                      style={{
                        background: CARD.parchment,
                        border: `3px solid ${CARD.borderOuter}`,
                        boxShadow: `4px 4px 0 ${CARD.parchmentDark}`,
                      }}
                    >
                      <div className="p-3 flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-pixel text-white font-bold text-base"
                          style={{ background: cave.color }}
                        >
                          {cave.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-pixel font-bold" style={{ color: CARD.ink }}>
                            {cave.name}
                          </h3>
                          <p className="font-pixel text-xs" style={{ color: CARD.inkMuted }}>
                            {caveLobsterCount} 只龙虾
                          </p>
                        </div>
                        <div
                          className="px-3 py-1 font-pixel text-sm font-bold"
                          style={{
                            background: CARD.parchmentDark,
                            color: CARD.ink,
                            border: `2px solid ${CARD.borderInner}`,
                          }}
                        >
                          选择
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <div
                className="p-4 flex gap-3"
                style={{
                  background: CARD.parchment,
                  borderTop: `4px solid ${CARD.borderOuter}`,
                }}
              >
                <button
                  onClick={() => setShowCaveDialog(false)}
                  className="flex-1 font-pixel font-bold py-2 transition-colors"
                  style={{
                    background: CARD.parchmentDark,
                    color: CARD.ink,
                    border: `3px solid ${CARD.borderInner}`,
                  }}
                >
                  取消
                </button>
                <button
                  onClick={() => confirmSummon(null)}
                  className="flex-1 font-pixel font-bold py-2 transition-colors"
                  style={{
                    background: '#eab308',
                    color: CARD.ink,
                    border: `3px solid ${CARD.borderOuter}`,
                  }}
                >
                  不放入窝
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
