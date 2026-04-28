'use client';

import { motion } from 'framer-motion';
import { ArchitectureAgent } from '@/types';

interface AgentSpriteProps {
  agent: ArchitectureAgent;
  isActive: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function AgentSprite({ agent, isActive, size = 'md' }: AgentSpriteProps) {
  const getAnimation = () => {
    if (agent.status === 'executing') {
      return {
        y: [0, -2, 0],
        rotate: [-3, 3, -3, 3, 0],
        transition: { duration: 0.3, repeat: Infinity }
      };
    } else if (agent.status === 'active') {
      return {
        y: [0, -4, 0],
        transition: { duration: 1, repeat: Infinity }
      };
    } else {
      return {
        x: [-1, 1, -1],
        transition: { duration: 0.5, repeat: Infinity }
      };
    }
  };

  const sizeClasses = {
    sm: {
      wrapper: 'w-12 h-14',
      head: 'w-6 h-6',
      body: 'w-8 h-6 top-6',
      arms: 'w-2 h-4 top-7'
    },
    md: {
      wrapper: 'w-16 h-18',
      head: 'w-8 h-8',
      body: 'w-10 h-8 top-7',
      arms: 'w-3 h-6 top-9'
    },
    lg: {
      wrapper: 'w-20 h-24',
      head: 'w-10 h-10',
      body: 'w-14 h-12 top-9',
      arms: 'w-4 h-8 top-12'
    }
  };

  const s = sizeClasses[size];

  return (
    <motion.div
      className={`relative flex flex-col items-center ${s.wrapper}`}
      animate={getAnimation()}
    >
      {/* Agent Body - Pixel Character */}
      <div className={`
        relative w-full h-full
        ${isActive ? 'scale-110' : ''}
        transition-transform
      `}>
        {/* Head */}
        <div className={`
          ${s.head}
          bg-pixel-yellow
          border-2 border-pixel-black
          mx-auto
          absolute
          top-0
          left-1/2 -translate-x-1/2
        `}>
          {/* Eyes */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 flex gap-1">
            <div className="w-1 h-1 bg-pixel-black rounded-full" />
            <div className="w-1 h-1 bg-pixel-black rounded-full" />
          </div>
        </div>

        {/* Body */}
        <div className={`
          ${s.body}
          ${agent.isManager ? 'bg-pixel-blue' : 'bg-pixel-green'}
          border-2 border-pixel-black
          absolute
          left-1/2 -translate-x-1/2
        `}>
          {/* Tie for manager */}
          {agent.isManager && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-4 bg-pixel-red" />
          )}
        </div>

        {/* Arms */}
        <div className={`
          ${s.arms}
          bg-pixel-yellow
          border-2 border-pixel-black
          absolute
          left-0
          -translate-x-1/2
        `} />
        <div className={`
          ${s.arms}
          bg-pixel-yellow
          border-2 border-pixel-black
          absolute
          right-0
          translate-x-1/2
        `} />
      </div>

      {/* BEEP BOOP particles when executing */}
      {agent.status === 'executing' && size === 'md' && (
        <>
          <motion.div
            className="absolute -top-4 left-1/2 font-pixel text-xs text-pixel-blue"
            animate={{ y: [-10, -30], opacity: [1, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0 }}
          >
            BEEP
          </motion.div>
          <motion.div
            className="absolute -top-4 right-0 font-pixel text-xs text-pixel-red"
            animate={{ y: [-15, -35], opacity: [1, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0.3 }}
          >
            BOOP
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
