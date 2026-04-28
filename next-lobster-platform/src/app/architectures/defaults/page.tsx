'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PixelCard } from '@/components/ui/PixelCard';
import { BackButton } from '@/components/ui/BackButton';
import { ARCH_TEMPLATES, encodeTemplate } from '@/lib/archTemplates';

const TEMPLATE_ICONS: Record<string, string> = {
  'research-team': '🔬',
  'creative-studio': '🎨',
  'code-factory': '💻',
  'content-factory': '✍️',
  '三省六部': '🏛️',
  'sdlc-pipeline': '🚀',
  'gov-admin': '🏢',
};

export default function DefaultArchitecturesPage() {
  const router = useRouter();

  const handleUseTemplate = (templateId: string) => {
    const template = ARCH_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    const encoded = encodeTemplate(template);
    router.push(`/architectures/create?template=${encoded}`);
  };

  return (
    <div className="max-w-6xl mx-auto pb-16">
      <BackButton href="/" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 mt-6"
      >
        <h1 className="chinese-large text-3xl text-pixel-black mb-2">
          默认架构模板
        </h1>
        <p className="font-pixel text-xl text-pixel-blue">
          DEFAULT ARCHITECTURE TEMPLATES
        </p>
        <p className="font-pixel text-sm text-pixel-black/60 mt-2">
          选择一个预设架构，快速启动你的团队协作流程
        </p>
      </motion.div>

      {/* Architecture Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ARCH_TEMPLATES.map((arch, index) => (
          <motion.div
            key={arch.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
          >
            <PixelCard
              title={`${TEMPLATE_ICONS[arch.id] ?? '📦'} ${arch.nameCn}`}
              className="h-full flex flex-col"
            >
              <p className="font-pixel text-xs text-pixel-blue mb-1">{arch.name}</p>
              <p className="font-pixel text-pixel-black/70 mb-4 text-sm leading-relaxed">
                {arch.descriptionCn}
              </p>

              {/* Agents Preview */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {arch.agents.slice(0, 6).map((agent, i) => (
                  <span
                    key={i}
                    className={`
                      px-2 py-0.5
                      border-2 border-pixel-black
                      font-pixel text-xs
                      ${agent.isManager ? 'bg-pixel-blue text-pixel-white' : 'bg-pixel-green text-pixel-white'}
                    `}
                  >
                    {agent.name}
                  </span>
                ))}
                {arch.agents.length > 6 && (
                  <span className="px-2 py-0.5 border-2 border-pixel-black font-pixel text-xs bg-pixel-gray text-pixel-white">
                    +{arch.agents.length - 6}
                  </span>
                )}
              </div>

              {/* Node count hint */}
              {arch.nodes && arch.nodes.length > 0 && (
                <p className="font-pixel text-xs text-pixel-black/40 mb-3">
                  {arch.nodes.length} 个节点 · {arch.edges?.length ?? 0} 条连接
                </p>
              )}

              <div className="mt-auto">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleUseTemplate(arch.id)}
                  className="w-full bg-pixel-blue text-pixel-white border-4 border-pixel-black font-pixel py-2.5 hover:bg-pixel-gray transition-colors"
                  style={{ boxShadow: '4px 4px 0px 0px #101010' }}
                >
                  使用此模板
                </motion.button>
              </div>
            </PixelCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
