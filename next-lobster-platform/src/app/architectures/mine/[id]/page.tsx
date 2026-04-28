'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { Architecture, ArchitectureAgent } from '@/types';
import { PixelButton } from '@/components/ui/PixelButton';
import { PixelInput } from '@/components/ui/PixelInput';
import { NodeFlowPreview } from '@/components/architecture/NodeFlowPreview';
import { ArchitectureInfo } from '@/components/architecture/ArchitectureInfo';
import { BackButton } from '@/components/ui/BackButton';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ArchitectureDetailPage() {
  const params = useParams();
  const router = useRouter();
  const archId = params.id as string;
  const { architectures, updateAgentStatus, setActiveAgent, setCurrentTask } = useStore();
  
  const architecture = architectures.find((a: Architecture) => a.id === archId);
  
  const [inputValue, setInputValue] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'system' | 'lobster' | 'error'; content: string; agentName?: string}>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [graphCollapsed, setGraphCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const archRef = useRef(architecture);

  // Initialize once when architecture loads
  useEffect(() => {
    const arch = architectures.find((a: Architecture) => a.id === archId);
    if (arch && !isInitialized) {
      setChatMessages([
        {
          role: 'system',
          content: `欢迎来到 ${arch.name}！在下方输入任务指令，将由项目经理（后端代理）接收并协调处理。`,
        },
      ]);
      arch.agents.forEach((agent: ArchitectureAgent) => {
        updateAgentStatus(archId, agent.id, 'standby');
      });
      setIsInitialized(true);
      archRef.current = arch;
    }
  }, [archId, isInitialized]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Execute task with research-bot-manager via local server proxy
  const executeTaskWithOpenClaw = async (task: string) => {
    const currentArch = archRef.current;
    if (!currentArch) return;

    const managerAgent = currentArch.agents.find((agent: ArchitectureAgent) => agent.isManager) ?? currentArch.agents[0];
    if (!managerAgent) return;

    const conversationHistory = chatMessages
      .filter(msg => msg.role === 'user' || msg.role === 'lobster')
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

    setIsProcessing(true);
    setCurrentTask(task);
    setActiveAgent(managerAgent.id);
    updateAgentStatus(archId, managerAgent.id, 'active');

    setChatMessages(prev => [...prev, { role: 'user', content: task }]);
    setInputValue('');

    setChatMessages(prev => [...prev, {
      role: 'system',
      content: `[${managerAgent.name}] 已接收任务，正在通过后端代理连接 OpenClaw...`,
      agentName: managerAgent.name,
    }]);

    try {
      updateAgentStatus(archId, managerAgent.id, 'executing');

      const response = await fetch('/api/lobsters/research-bot-manager/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: task,
          messages: conversationHistory,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || '调用 research-bot-manager 失败');
      }

      const reply = typeof data?.reply === 'string' ? data.reply.trim() : '';
      if (!reply) {
        throw new Error('research-bot-manager 返回了空响应');
      }

      setChatMessages(prev => [...prev, {
        role: 'lobster',
        content: reply,
        agentName: managerAgent.name,
      }]);
    } catch (error) {
      setChatMessages(prev => [...prev, {
        role: 'error',
        content: `[${managerAgent.name}] ❌ ${error instanceof Error ? error.message : '未知错误'}`,
        agentName: managerAgent.name,
      }]);
    } finally {
      updateAgentStatus(archId, managerAgent.id, 'standby');
      setActiveAgent(null);
      setCurrentTask(null);
      setIsProcessing(false);
    }
  };

  const handleSend = () => {
    if (!inputValue.trim() || isProcessing) return;
    executeTaskWithOpenClaw(inputValue.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!architecture) {
    return (
      <div className="text-center py-16">
        <h2 className="chinese-large text-pixel-black text-2xl">架构未找到</h2>
        <PixelButton onClick={() => router.push('/architectures/mine')} className="mt-6 text-lg">
          返回架构列表
        </PixelButton>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-6 mt-6"
      >
        <BackButton onClick={() => router.push('/')} />
        <h1 className="chinese-large text-2xl text-pixel-black flex-1">
          {architecture.name}
        </h1>
      </motion.div>

      {/* Architecture Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <ArchitectureInfo architecture={architecture} />
      </motion.div>

      {/* Node Flow Preview — Collapsible */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <button
          onClick={() => setGraphCollapsed(!graphCollapsed)}
          className="w-full flex items-center justify-between px-2 py-1 mb-2 cursor-pointer"
        >
          <h2 className="chinese-large text-xl text-pixel-black">架构节点图</h2>
          <div className="flex items-center gap-3">
            <span className="font-pixel text-base text-pixel-black/60">
              {graphCollapsed ? '点击展开' : '点击收起'}
            </span>
            <motion.div
              animate={{ rotate: graphCollapsed ? 0 : 180 }}
              transition={{ duration: 0.2 }}
              className="text-pixel-black text-2xl leading-none"
            >
              ▼
            </motion.div>
          </div>
        </button>

        <AnimatePresence initial={false}>
          {!graphCollapsed && (
            <motion.div
              key="graph"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <NodeFlowPreview architecture={architecture} />
            </motion.div>
          )}
        </AnimatePresence>

        {graphCollapsed && (
          <div
            className="h-12 bg-pixel-gray/20 border-4 border-pixel-black flex items-center justify-center font-pixel text-pixel-black/40 text-sm"
            style={{ boxShadow: '4px 4px 0px 0px #101010' }}
          >
            ▶ {architecture.name} — {architecture.agents.length} 名成员 · {architecture.edges?.length ?? 0} 条连接
          </div>
        )}
      </motion.div>

      {/* Chat Dialog */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-pixel-white border-4 border-pixel-black"
        style={{ boxShadow: '8px 8px 0px 0px #101010' }}
      >
        {/* Chat Header */}
        <div className="bg-pixel-blue text-pixel-white font-pixel text-xl p-4 border-b-4 border-pixel-black flex items-center gap-2">
          <span className="animate-pulse">{">"}</span>
          <span>指令控制台</span>
          {isProcessing && (
            <span className="ml-auto bg-pixel-yellow text-pixel-black px-3 py-1 text-sm animate-pulse">
              执行中...
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="p-6 min-h-[350px] max-h-[450px] overflow-y-auto bg-pixel-white">
          <AnimatePresence>
            {chatMessages.map((msg, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className={`mb-4 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}
              >
                <div
                  className={`
                    inline-block
                    max-w-[85%]
                    px-5 py-3
                    font-pixel text-base
                    text-left
                    ${msg.role === 'user' 
                      ? 'bg-pixel-blue text-pixel-white border-4 border-pixel-black' 
                      : msg.role === 'lobster'
                      ? 'bg-pixel-green text-pixel-white border-4 border-pixel-black' 
                      : msg.role === 'error'
                      ? 'bg-pixel-red text-pixel-white border-4 border-pixel-black'
                      : 'bg-pixel-gray/50 text-pixel-black border-4 border-pixel-black'}
                  `}
                  style={{ boxShadow: '3px 3px 0px 0px #101010' }}
                >
                  {msg.agentName && (
                    <div className="font-pixel text-sm opacity-70 mb-1 border-b border-pixel-white/20 pb-1">
                      {msg.agentName}
                    </div>
                  )}
                  {msg.role === 'lobster' ? (
                    <div className="font-pixel text-sm [&_p]:mb-2 [&_pre]:bg-pixel-black/20 [&_pre]:p-3 [&_pre]:rounded [&_code]:bg-pixel-black/10 [&_code]:px-1 [&_code]:rounded [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_strong]:font-bold [&_em]:italic [&_a]:underline [&_a]:text-pixel-white/80">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t-4 border-pixel-black p-4 bg-pixel-gray/20">
          <div className="flex gap-3">
            <PixelInput
              value={inputValue}
              onChange={setInputValue}
              onKeyDown={handleKeyDown}
              placeholder="输入任务指令..."
              className="flex-1"
              disabled={isProcessing}
            />
            <PixelButton
              onClick={handleSend}
              disabled={!inputValue.trim() || isProcessing}
              variant="primary"
              className="text-base px-6"
            >
              {isProcessing ? '执行中...' : '发送'}
            </PixelButton>
          </div>
          <p className="font-pixel text-sm text-pixel-black/50 mt-3 text-center">
            任务将通过本地接口转发，由团队架构协调执行
          </p>
        </div>
      </motion.div>
    </div>
  );
}
