'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface PixelCardProps {
  children: ReactNode;
  title?: string;
  onClick?: () => void;
  className?: string;
  hoverable?: boolean;
}

export function PixelCard({
  children,
  title,
  onClick,
  className = '',
  hoverable = true
}: PixelCardProps) {
  return (
    <motion.div
      whileHover={hoverable ? { scale: 1.02 } : {}}
      onClick={onClick}
      className={`
        bg-pixel-white
        border-4
        border-pixel-black
        flex flex-col min-h-0
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      style={{
        boxShadow: '6px 6px 0px 0px #101010'
      }}
    >
      {title && (
        <div className="bg-pixel-blue text-pixel-white font-pixel text-lg p-2 border-b-4 border-pixel-black">
          {title}
        </div>
      )}
      <div className="p-4 flex-1 flex flex-col min-h-0">
        {children}
      </div>
    </motion.div>
  );
}
