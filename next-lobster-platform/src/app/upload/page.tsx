'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelInput } from '@/components/ui/PixelInput';
import { BackButton } from '@/components/ui/BackButton';

export default function UploadPage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lobsterName, setLobsterName] = useState('');
  const [publishToMarket, setPublishToMarket] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!lobsterName) {
        setLobsterName(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleUpload = () => {
    if (!lobsterName) return;
    setIsUploading(true);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setIsUploading(false);
          router.push(
            `/upload/design?name=${encodeURIComponent(lobsterName)}&publish=${publishToMarket}`
          );
        }, 400);
      }
    }, 150);
  };

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <BackButton href="/" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-pixel-white border-4 border-pixel-black p-6 mt-6"
        style={{ boxShadow: '8px 8px 0px 0px #101010' }}
      >
        <h1 className="font-pixel text-3xl text-pixel-black text-center mb-2">
          上传本地龙虾包
        </h1>
        <p className="font-pixel text-sm text-pixel-black/60 text-center mb-8">
          UPLOAD LOCAL LOBSTER PACKAGE
        </p>

        {/* Upload Zone */}
        <div
          className={`
            border-4 border-dashed
            ${selectedFile ? 'border-pixel-green bg-pixel-green/10' : 'border-pixel-black'}
            p-8 text-center mb-6
          `}
        >
          <input
            type="file"
            accept=".zip"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            {selectedFile ? (
              <div>
                <div className="mb-3 flex justify-center">
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-5xl"
                  >
                    📦
                  </motion.div>
                </div>
                <p className="font-pixel text-pixel-black text-lg">{selectedFile.name}</p>
                <p className="font-pixel text-pixel-black/60 text-sm mt-2">
                  {(selectedFile.size / 1024).toFixed(1)} KB · 点击更换文件
                </p>
              </div>
            ) : (
              <div>
                <div className="mb-4 flex justify-center">
                  <svg viewBox="0 0 24 24" className="w-16 h-16 text-pixel-black/50">
                    <path
                      fill="currentColor"
                      d="M6 2h9l5 5v15H6V2zm8 1v5h5M12 11v6M9 14l3-3 3 3"
                    />
                  </svg>
                </div>
                <p className="font-pixel text-pixel-black font-bold mb-1">
                  点击选择压缩包
                </p>
                <p className="font-pixel text-pixel-black/60 text-sm">
                  支持 .zip 格式（包含龙虾配置文件）
                </p>
              </div>
            )}
          </label>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="font-pixel text-pixel-black block mb-2">
              龙虾名称
            </label>
            <PixelInput
              value={lobsterName}
              onChange={setLobsterName}
              placeholder="给你的龙虾起个名字..."
              className="w-full"
            />
          </div>

          {/* Publish to Market Toggle */}
          <div
            className="border-4 border-pixel-black p-4 bg-pixel-white/60"
            style={{ boxShadow: '4px 4px 0 #101010' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-4">
                <p className="font-pixel text-pixel-black font-bold mb-1">
                  公开到龙虾市场
                </p>
                <p className="font-pixel text-xs text-pixel-black/60">
                  允许其他玩家在市场上发现并领养你的龙虾
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPublishToMarket(!publishToMarket)}
                className={`
                  relative w-16 h-9 border-4 border-pixel-black transition-colors shrink-0
                  ${publishToMarket ? 'bg-pixel-green' : 'bg-pixel-gray'}
                `}
                style={{ boxShadow: publishToMarket ? '2px 2px 0 #101010' : '2px 2px 0 #101010' }}
              >
                <motion.div
                  animate={{ x: publishToMarket ? 24 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="absolute top-0.5 left-0.5 w-6 h-6 bg-pixel-white border-2 border-pixel-black"
                />
              </button>
            </div>
          </div>

          <PixelButton
            onClick={handleUpload}
            disabled={!lobsterName.trim() || isUploading}
            variant="primary"
            size="lg"
            className="w-full"
          >
            {isUploading ? (
              <span>解析中... {uploadProgress}%</span>
            ) : (
              <span>开始设计龙虾形象</span>
            )}
          </PixelButton>
        </div>
      </motion.div>

      {/* Progress Bar */}
      {isUploading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4"
        >
          <div className="h-4 bg-pixel-black border-2 border-pixel-black">
            <motion.div
              className="h-full bg-pixel-green"
              animate={{ width: `${uploadProgress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}
