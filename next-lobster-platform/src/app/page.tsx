'use client';

import { motion } from 'framer-motion';
import { SectionA, SectionB, MenuCard } from '@/components/layout/Dashboard';
import { LobsterCard } from '@/components/lobster/LobsterCard';
import { useStore } from '@/store/useStore';
import { Lobster, Architecture } from '@/types';

export default function HomePage() {
  const { lobsters, architectures } = useStore();

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="chinese-large text-pixel-black mb-2">
          欢迎来到龙虾世界
        </h1>
        <p className="font-pixel text-xl text-pixel-blue">
          WELCOME TO LOBSTER WORLD
        </p>
        <p className="font-pixel text-sm text-pixel-black/60 mt-2">
          选择入口开始您的智能体管理之旅
        </p>
      </motion.div>

      {/* Two-Section Dashboard */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Section A: Single Lobster Management */}
        <SectionA>
          <div className="space-y-4">
            <MenuCard
              href="/adopt"
              title="快速领养"
              description="Quick Adopt | 立即获取新伙伴"
              color="bg-pixel-green"
              delay={0.1}
              icon={
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-pixel-green">
                  <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                  <ellipse cx="12" cy="12" rx="6" ry="8" fill="none" stroke="currentColor" strokeWidth="2"/>
                </svg>
              }
            />

            <MenuCard
              href="/upload"
              title="上传龙虾"
              description="Upload | 导入训练好的模型"
              color="bg-pixel-blue"
              delay={0.2}
              icon={
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-pixel-blue">
                  <path fill="currentColor" d="M6 2h9l5 5v15H6V2zm8 1v5h5M12 11v6M9 14l3-3 3 3"/>
                </svg>
              }
            />

            <MenuCard
              href="/market"
              title="龙虾市场"
              description="Market | 浏览特色龙虾"
              color="bg-pixel-yellow"
              delay={0.3}
              icon={
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-pixel-yellow">
                  <path fill="currentColor" d="M18.36 9l.6 3H5.04l.6-3h12.72M20 4H4v2h16V4zm0 3H4l-1 5v2h1v6h10v-6h4v6h2v-6h1v-2l-1-5zM6 18v-4h6v4H6z"/>
                </svg>
              }
            />

            <MenuCard
              href="/my-den"
              title="我的龙虾窝"
              description={`My Lobsters | 拥有 ${lobsters.length} 只龙虾`}
              color="bg-pixel-red"
              delay={0.4}
              icon={
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-pixel-red">
                  <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
              }
            />
          </div>

          {/* Recent Lobsters Preview */}
          {lobsters.length > 0 && (
            <div className="mt-6">
              <h3 className="font-pixel text-base text-pixel-black mb-3">最近龙虾</h3>
              <div className="grid grid-cols-3 gap-2">
                {lobsters.slice(0, 3).map((lobster: Lobster) => (
                  <LobsterCard key={lobster.id} lobster={lobster} />
                ))}
              </div>
            </div>
          )}
        </SectionA>

        {/* Section B: Architecture Management */}
        <SectionB>
          <div className="space-y-4">
            <MenuCard
              href="/architectures/create"
              title="创建架构"
              description="Create | 设计新的协作架构"
              color="bg-pixel-blue"
              delay={0.1}
              icon={
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-pixel-blue">
                  <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
              }
            />

            <MenuCard
              href="/architectures/defaults"
              title="默认架构"
              description="Defaults | 标准模板快速启动"
              color="bg-pixel-gray"
              delay={0.2}
              icon={
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-pixel-gray">
                  <path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                </svg>
              }
            />

            <MenuCard
              href="/architectures/mine"
              title="我的架构"
              description={`My Architectures | 已创建 ${architectures.length} 个`}
              color="bg-pixel-green"
              delay={0.3}
              icon={
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-pixel-green">
                  <path fill="currentColor" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              }
            />
          </div>

          {/* Architecture Preview */}
          {architectures.length > 0 && (
            <div className="mt-6">
              <h3 className="font-pixel text-base text-pixel-black mb-3">最近架构</h3>
              <div className="space-y-2">
                {architectures.slice(0, 2).map((arch: Architecture) => (
                  <motion.div
                    key={arch.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-pixel-white border-4 border-pixel-black p-3 flex items-center justify-between"
                    style={{ boxShadow: '4px 4px 0px 0px #101010' }}
                  >
                    <div>
                      <h4 className="font-pixel text-pixel-black">{arch.name}</h4>
                      <p className="font-pixel text-xs text-pixel-black/60">
                        {arch.agents.length} members
                      </p>
                    </div>
                    <a
                      href={`/architectures/mine/${arch.id}`}
                      className="px-3 py-1 bg-pixel-blue text-pixel-white border-2 border-pixel-black font-pixel text-xs hover:bg-pixel-gray transition-colors"
                      style={{ boxShadow: '2px 2px 0px 0px #101010' }}
                    >
                      Open
                    </a>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </SectionB>
      </div>
    </div>
  );
}
