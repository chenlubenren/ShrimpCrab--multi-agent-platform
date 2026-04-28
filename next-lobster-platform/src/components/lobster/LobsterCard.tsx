import { Lobster } from '@/types';
import { motion } from 'framer-motion';
import { PixelCard } from '@/components/ui/PixelCard';
import { LobsterSprite } from './LobsterSprite';
import { useRouter } from 'next/navigation';

interface LobsterCardProps {
  lobster: Lobster;
}

export function LobsterCard({ lobster }: LobsterCardProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/my-den/${lobster.id}`);
  };

  return (
    <PixelCard onClick={handleClick} className="w-full h-full min-h-[300px] flex flex-col">
      <div className="flex flex-col items-center gap-3 flex-1 justify-between">
        <LobsterSprite lobster={lobster} size="lg" />
        <div className="text-center w-full flex flex-col flex-1 justify-end">
          {/* 龙虾名放大 */}
          <p className="font-pixel text-base text-pixel-black font-bold mb-1 line-clamp-2 min-h-[2.5rem]">
            {lobster.name}
          </p>
          {/* Function: 固定至少两行高度，避免短描述卡片变矮 */}
          <p className="font-pixel text-xs text-pixel-black/60 leading-snug min-h-[2.75rem]">
            Function: {lobster.role}
          </p>
          <p className="font-pixel text-xs text-pixel-black/40 mt-1">
            Joined: {new Date(lobster.createdAt).toLocaleDateString('en-US')}
          </p>
        </div>
      </div>
    </PixelCard>
  );
}
