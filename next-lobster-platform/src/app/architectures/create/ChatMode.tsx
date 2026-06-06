'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { PixelButton } from '@/components/ui/PixelButton';
import { useStore } from '@/store/useStore';
import type { ArchitectureAgent, ArchitectureEdge, ArchitectureNode, WorkflowDsl } from '@/types';
import { generateWorkflowDslFromPrompt } from '@/lib/api';
import {
  buildArchitectureAgentsFromWorkflowDsl,
  buildCanvasGraphFromWorkflowDsl,
} from '@/lib/workflowDsl';

export interface GeneratedWorkflowPayload {
  name: string;
  description: string;
  workflowDsl: WorkflowDsl;
  agents: ArchitectureAgent[];
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  generator: 'deepseek' | 'pi' | 'fallback';
  warnings?: string[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: string;
  generatedWorkflow?: GeneratedWorkflowPayload;
}

const EXAMPLES = [
  '我想创建一个研究团队：项目经理负责拆分任务，研究员检索资料，实验助手分析数据，最后写作助手生成报告。如果质量审核不通过就回到实验分析。',
  '一个创意团队，需要创意总监制定方向，素材收集员和视觉设计师并行工作，最后运营发布。',
];

interface ChatModeProps {
  onWorkflowGenerated: (workflow: GeneratedWorkflowPayload) => void;
}

function getGeneratorLabel(generator: GeneratedWorkflowPayload['generator']): string {
  if (generator === 'deepseek') return 'DeepSeek';
  if (generator === 'pi') return 'Pi Agent';
  return '绋冲畾 fallback';
}

export default function ChatMode({ onWorkflowGenerated }: ChatModeProps) {
  const { lobsters } = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '描述你想要的多 Agent 工作流。我会调用后端 Pi Agent 转成 Workflow DSL，再生成可编辑画布。',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generate = async (prompt: string) => {
    if (!prompt.trim() || isGenerating) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: prompt.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);

    try {
      const result = await generateWorkflowDslFromPrompt({
        prompt: prompt.trim(),
        availableAgents: lobsters.map((agent) => ({
          id: agent.id,
          name: agent.name,
          role: agent.role,
          description: agent.description,
          tags: agent.tags,
        })),
      });

      const graph = buildCanvasGraphFromWorkflowDsl(result.workflowDsl, lobsters);
      const agents = buildArchitectureAgentsFromWorkflowDsl(result.workflowDsl, lobsters);
      const workflow: GeneratedWorkflowPayload = {
        name: result.workflowDsl.name,
        description: result.workflowDsl.description,
        workflowDsl: result.workflowDsl,
        agents,
        nodes: graph.nodes,
        edges: graph.edges,
        generator: result.generator,
        warnings: result.warnings,
      };

      const warnings = result.warnings.length > 0
        ? `\n\n提示：\n${result.warnings.map((warning) => `- ${warning}`).join('\n')}`
        : '';
      const agentLines = agents.length > 0
        ? agents.map((agent, index) => `${index + 1}. ${agent.name}：${agent.role}${agent.linkedLobsterId ? '（已自动绑定）' : '（待绑定真实 Agent）'}`).join('\n')
        : '未生成 Agent 节点';

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content:
            `已生成 Workflow DSL。\n\n` +
            `名称：${workflow.name}\n` +
            `生成器：${getGeneratorLabel(workflow.generator)}\n\n` +
            `节点：\n${agentLines}${warnings}\n\n` +
            `点击“应用到画布”后可以继续手动调整节点和连线。`,
          timestamp: new Date().toISOString(),
          generatedWorkflow: workflow,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'error',
          content: error instanceof Error ? error.message : '生成 Workflow DSL 失败',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyWorkflow = (workflow: GeneratedWorkflowPayload) => {
    onWorkflowGenerated(workflow);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex-1 overflow-y-auto space-y-4 p-1">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`
                max-w-[85%] px-4 py-3 border-4 border-pixel-black
                ${msg.role === 'user'
                  ? 'bg-pixel-blue text-pixel-white'
                  : msg.role === 'error'
                    ? 'bg-pixel-red text-pixel-white'
                    : 'bg-pixel-white text-pixel-black'
                }
              `}
              style={{ boxShadow: '4px 4px 0px 0px #101010' }}
            >
              <div className="font-pixel text-sm whitespace-pre-wrap leading-relaxed">
                {msg.content}
              </div>

              {msg.role === 'assistant' && msg.generatedWorkflow && (
                <div className="mt-3 flex gap-2">
                  <PixelButton
                    onClick={() => handleApplyWorkflow(msg.generatedWorkflow!)}
                    variant="primary"
                    size="sm"
                  >
                    应用到画布
                  </PixelButton>
                </div>
              )}

              <div className={`mt-1 font-pixel text-xs ${msg.role === 'user' ? 'text-pixel-white/60' : 'text-pixel-black/40'}`}>
                {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </motion.div>
        ))}

        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-pixel-white border-4 border-pixel-black px-4 py-3" style={{ boxShadow: '4px 4px 0px 0px #101010' }}>
              <div className="flex items-center gap-2">
                <span className="font-pixel text-sm text-pixel-black">后端正在生成 DSL</span>
                <motion.span
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="font-pixel text-sm text-pixel-black"
                >
                  ...
                </motion.span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {messages.length === 1 && !isGenerating && (
        <div className="bg-pixel-white border-4 border-pixel-black" style={{ boxShadow: '4px 4px 0px 0px #101010' }}>
          <button
            onClick={() => setShowExamples(!showExamples)}
            className="w-full px-4 py-2 font-pixel text-xs text-pixel-black/60 text-left flex items-center justify-between hover:bg-pixel-gray/30 transition-colors"
          >
            选择示例快速开始
            <span className="text-lg leading-none">{showExamples ? '▲' : '▼'}</span>
          </button>
          {showExamples && (
            <div className="flex flex-col gap-2 p-4 pt-0">
              {EXAMPLES.map((example) => (
                <motion.button
                  key={example}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => generate(example)}
                  className="w-full p-3 border-3 border-pixel-black text-left font-pixel text-sm bg-pixel-gray text-pixel-black transition-colors"
                >
                  {example}
                </motion.button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-pixel-white border-4 border-pixel-black p-4" style={{ boxShadow: '4px 4px 0px 0px #101010' }}>
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && generate(input)}
            placeholder="描述你想要的 Agent 团队..."
            disabled={isGenerating}
            className="flex-1 bg-pixel-white border-4 border-pixel-black font-pixel text-sm px-4 py-3 focus:outline-none focus:border-pixel-blue disabled:bg-pixel-gray disabled:cursor-not-allowed"
          />
          <PixelButton
            onClick={() => generate(input)}
            disabled={!input.trim() || isGenerating}
            variant="primary"
            size="md"
          >
            生成 DSL
          </PixelButton>
        </div>
      </div>
    </div>
  );
}
