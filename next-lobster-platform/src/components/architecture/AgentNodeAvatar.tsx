'use client';

import type { Lobster } from '@/types';

interface AgentNodeAvatarProps {
  lobster?: Pick<Lobster, 'name' | 'avatar'> | null;
  size?: 'sm' | 'md';
}

const SIZE_CLASS = {
  sm: 'h-12 w-12',
  md: 'h-16 w-16',
};

export function AgentNodeAvatar({ lobster, size = 'md' }: AgentNodeAvatarProps) {
  const frameSize = SIZE_CLASS[size];
  const avatar = lobster?.avatar?.trim();

  if (avatar) {
    return (
      <div className={`${frameSize} relative flex shrink-0 items-center justify-center border-3 border-pixel-black bg-pixel-white`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Runtime agent avatars can be user-uploaded URLs. */}
        <img
          src={avatar}
          alt={lobster?.name || 'Agent'}
          className="h-full w-full object-contain"
          style={{ imageRendering: 'pixelated' }}
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div
      className={`${frameSize} relative flex shrink-0 items-center justify-center overflow-hidden border-3 border-pixel-black bg-pixel-white`}
      aria-label="未指定 Agent"
      title="未指定 Agent"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Static fallback silhouette. */}
      <img
        src="/claw_profile/lobster-captain-coral.png"
        alt=""
        className="h-full w-full object-contain opacity-25 brightness-0"
        style={{ imageRendering: 'pixelated' }}
        draggable={false}
      />
      <span className="absolute inset-0 flex items-center justify-center font-pixel text-3xl font-bold text-pixel-red">
        ?
      </span>
    </div>
  );
}
