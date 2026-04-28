'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

interface BackButtonProps {
  href?: string;
  onClick?: () => void;
}

export function BackButton({ href, onClick }: BackButtonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      {href ? (
        <Link href={href}>
          <button
            className="
              flex items-center gap-2
              px-4 py-2
              bg-pixel-white
              border-4 border-pixel-black
              font-pixel text-pixel-black
              hover:bg-pixel-yellow
              transition-colors
            "
            style={{ boxShadow: '4px 4px 0px 0px #101010' }}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            Home
          </button>
        </Link>
      ) : (
        <button
          onClick={onClick}
          className="
            flex items-center gap-2
            px-4 py-2
            bg-pixel-white
            border-4 border-pixel-black
            font-pixel text-pixel-black
            hover:bg-pixel-yellow
            transition-colors
          "
          style={{ boxShadow: '4px 4px 0px 0px #101010' }}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          Home
        </button>
      )}
    </motion.div>
  );
}
