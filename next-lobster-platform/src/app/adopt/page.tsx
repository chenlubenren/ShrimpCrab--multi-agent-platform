'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelInput } from '@/components/ui/PixelInput';
import { BackButton } from '@/components/ui/BackButton';
import { useStore } from '@/store/useStore';
import { Lobster } from '@/types';

export default function AdoptPage() {
  const router = useRouter();
  const { addLobster } = useStore();
  const [name, setName] = useState('');
  const [role, setRole] = useState('General Assistant');
  const [isHatching, setIsHatching] = useState(false);
  const [hatchProgress, setHatchProgress] = useState(0);

  const roles = [
    'General Assistant',
    'Research Assistant',
    'Writing Assistant',
    'Data Analyst',
    'Coding Expert',
    'Creative Consultant'
  ];

  const handleAdopt = () => {
    if (!name.trim()) return;
    
    setIsHatching(true);
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setHatchProgress(progress);
      
      if (progress >= 100) {
        clearInterval(interval);
        
        const newLobster: Lobster = {
          id: `lobster-${Date.now()}`,
          name: name.trim(),
          role: role,
          status: 'idle',
          createdAt: new Date().toISOString(),
          conversations: [{
            id: `conv-${Date.now()}`,
            role: 'lobster',
            content: `Hello! I am ${name.trim()}, a happy lobster. Nice to meet you! How can I help you?`,
            timestamp: new Date().toISOString()
          }]
        };
        
        addLobster(newLobster);
        
        setTimeout(() => {
          router.push('/my-den');
        }, 500);
      }
    }, 100);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <BackButton href="/" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-pixel-white border-4 border-pixel-black p-6 mt-6"
        style={{ boxShadow: '8px 8px 0px 0px #101010' }}
      >
        <h1 className="font-pixel text-3xl text-pixel-black text-center mb-6">
          Quick Adopt Lobster
        </h1>

        {/* Egg Animation */}
        <div className="flex justify-center mb-8">
          <motion.div
            animate={isHatching ? {
              scale: [1, 1.1, 1],
              rotate: [0, -5, 5, 0]
            } : {}}
            transition={{ duration: 0.5, repeat: isHatching ? Infinity : 0 }}
            className="relative"
          >
            {/* Egg */}
            <div className={`
              w-32 h-40
              ${isHatching ? 'bg-pixel-yellow' : 'bg-pixel-white'}
              border-4 border-pixel-black
              rounded-t-full
              relative
            `}>
              {/* Spots */}
              <div className="absolute top-8 left-6 w-4 h-4 bg-pixel-yellow rounded-full" />
              <div className="absolute top-16 right-8 w-3 h-3 bg-pixel-yellow rounded-full" />
              <div className="absolute bottom-12 left-10 w-5 h-5 bg-pixel-yellow rounded-full" />
              
              {isHatching && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 0.3, repeat: Infinity }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <span className="text-4xl">*</span>
                </motion.div>
              )}
            </div>

            {/* Progress Bar */}
            {isHatching && (
              <div className="mt-4">
                <div className="w-32 h-4 bg-pixel-black border-2 border-pixel-white">
                  <motion.div
                    className="h-full bg-pixel-green"
                    initial={{ width: 0 }}
                    animate={{ width: `${hatchProgress}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
                <p className="font-pixel text-center text-sm text-pixel-black mt-1">
                  Hatching... {hatchProgress}%
                </p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Form */}
        {!isHatching && (
          <div className="space-y-4">
            <div>
              <label className="font-pixel text-pixel-black block mb-2">
                Lobster Name
              </label>
              <PixelInput
                value={name}
                onChange={setName}
                placeholder="Give your lobster a name..."
                className="w-full"
              />
            </div>

            <div>
              <label className="font-pixel text-pixel-black block mb-2">
                Select Role
              </label>
              <div className="grid grid-cols-3 gap-2">
                {roles.map((r) => (
                  <motion.button
                    key={r}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setRole(r)}
                    className={`
                      px-3 py-2
                      font-pixel text-sm
                      border-4 border-pixel-black
                      transition-colors
                      ${role === r 
                        ? 'bg-pixel-blue text-pixel-white' 
                        : 'bg-pixel-white text-pixel-black hover:bg-pixel-gray'}
                    `}
                  >
                    {r}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="pt-4">
              <PixelButton
                onClick={handleAdopt}
                disabled={!name.trim()}
                variant="primary"
                size="lg"
                className="w-full"
              >
                Start Hatching!
              </PixelButton>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
