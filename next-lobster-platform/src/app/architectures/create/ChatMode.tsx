'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PixelButton } from '@/components/ui/PixelButton';
import { ArchitectureAgent } from '@/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  parsedAgents?: ArchitectureAgent[];
}

const SYSTEM_PROMPTS = `你是一个专业的架构设计师。请根据用户的需求描述，设计团队成员架构。

对于每个成员，请指定：
- 名称（name）
- 角色/职责（role）
- 是否管理员（isManager, 默认 false）
- 输入端口（inputs, 该成员需要接收什么信息）
- 输出端口（outputs, 该成员会产出什么）

请用以下 JSON 格式回复（只输出 JSON，不要其他内容）：
{
  "architectureName": "架构名称",
  "description": "架构描述",
  "agents": [
    {
      "name": "成员名称",
      "role": "职责描述",
      "isManager": true/false,
      "inputs": ["输入1", "输入2"],
      "outputs": ["输出1", "输出2"]
    }
  ]
}`;

const EXAMPLE_ANSWERS = [
  {
    description: '我想创建一个研究团队，包含一个管理人负责分配任务，一个研究员负责制定研究计划，一个执行者负责执行，最后一个撰稿人负责写报告',
    result: {
      architectureName: '学术研究团队',
      description: '一个完整的学术研究工作流团队',
      agents: [
        { name: '项目经理', role: '任务分配与协调', isManager: true, inputs: ['用户需求'], outputs: ['任务分配'] },
        { name: '研究员', role: '研究计划制定', isManager: false, inputs: ['任务分配'], outputs: ['研究计划'] },
        { name: '执行者', role: '任务执行', isManager: false, inputs: ['任务分配'], outputs: ['执行结果'] },
        { name: '撰稿人', role: '报告撰写', isManager: false, inputs: ['研究计划', '执行结果'], outputs: ['最终报告'] },
      ],
    },
  },
  {
    description: '一个创意团队，需要灵感收集、视觉设计和文案撰写',
    result: {
      architectureName: '创意工坊',
      description: '专注于创意内容生成的智能体团队',
      agents: [
        { name: '创意总监', role: '创意方向把控', isManager: true, inputs: ['用户需求'], outputs: ['创意方向'] },
        { name: '灵感收集者', role: '素材收集与整理', isManager: false, inputs: ['创意方向'], outputs: ['素材库'] },
        { name: '视觉设计师', role: '视觉创意设计', isManager: false, inputs: ['创意方向', '素材库'], outputs: ['设计方案'] },
        { name: '文案撰写师', role: '文案创作', isManager: false, inputs: ['素材库', '设计方案'], outputs: ['创意内容'] },
      ],
    },
  },
];

function parseArchitectureFromText(text: string): { name: string; description: string; agents: ArchitectureAgent[] } | null {
  // Try to find JSON in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.architectureName || !parsed.agents) return null;

    const agents: ArchitectureAgent[] = parsed.agents.map((a: Partial<ArchitectureAgent>, i: number) => ({
      id: `agent-${Date.now()}-${i}`,
      name: a.name || `成员${i + 1}`,
      role: a.role || '成员',
      status: 'standby' as const,
      isManager: a.isManager ?? false,
      inputs: a.inputs ?? [],
      outputs: a.outputs ?? [],
    }));

    return {
      name: parsed.architectureName,
      description: parsed.description || '',
      agents,
    };
  } catch {
    return null;
  }
}

interface ChatModeProps {
  onAgentsGenerated: (agents: ArchitectureAgent[], name: string, description: string) => void;
}

export default function ChatMode({ onAgentsGenerated }: ChatModeProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `你好！我是架构设计助手。请描述你想要的团队架构，我会帮你生成。

例如：*"我想创建一个研究团队，包含一个管理人负责分配任务，一个研究员负责制定研究计划，一个执行者负责执行，最后一个撰稿人负责写报告"*

或者：*"一个创意团队，需要灵感收集、视觉设计和文案撰写"*`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedExample, setSelectedExample] = useState<number | null>(null);
  const [showExamples, setShowExamples] = useState(true);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);
    setSelectedExample(null);

    // Simulate AI generation
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const textResponse = `根据你的描述，我来设计这个架构：

{
  "architectureName": "学术研究团队",
  "description": "一个完整的学术研究工作流团队",
  "agents": [
    {
      "name": "项目经理",
      "role": "任务分配与协调",
      "isManager": true,
      "inputs": ["用户需求"],
      "outputs": ["任务分配"]
    },
    {
      "name": "研究员",
      "role": "研究计划制定",
      "isManager": false,
      "inputs": ["任务分配"],
      "outputs": ["研究计划"]
    },
    {
      "name": "执行者",
      "role": "任务执行",
      "isManager": false,
      "inputs": ["任务分配"],
      "outputs": ["执行结果"]
    },
    {
      "name": "撰稿人",
      "role": "报告撰写",
      "isManager": false,
      "inputs": ["研究计划", "执行结果"],
      "outputs": ["最终报告"]
    }
  ]
}

✅ 以上是为你生成的架构预览。你可以点击"应用此架构"按钮将其应用到画布上，或继续描述更多需求。`;

    const parsed = parseArchitectureFromText(textResponse);
    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: textResponse,
      timestamp: new Date().toISOString(),
      parsedAgents: parsed?.agents,
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setIsGenerating(false);
  };

  const handleExampleClick = async (example: typeof EXAMPLE_ANSWERS[0], index: number) => {
    setSelectedExample(index);
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: example.description,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsGenerating(true);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const parsed = example.result;
    // Transform parsed agents to full ArchitectureAgent type
    const fullAgents: ArchitectureAgent[] = parsed.agents.map((a: Partial<ArchitectureAgent>, i: number) => ({
      id: `agent-${Date.now()}-${i}`,
      name: a.name || `成员${i + 1}`,
      role: a.role || '成员',
      status: 'standby' as const,
      isManager: a.isManager ?? false,
      inputs: a.inputs ?? [],
      outputs: a.outputs ?? [],
    }));
    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: `✅ 已根据你的描述生成架构！

**架构名称：** ${parsed.architectureName}
**描述：** ${parsed.description}

**成员列表：**
${parsed.agents.map((a, i) => `  ${i + 1}. ${a.name}（${a.role}）${a.isManager ? '⭐ 管理员' : ''}
     输入: ${a.inputs.join(', ')}
     输出: ${a.outputs.join(', ')}`).join('\n\n')}

点击下方"应用此架构"按钮，将其应用到画布中。`,
      timestamp: new Date().toISOString(),
      parsedAgents: fullAgents,
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setIsGenerating(false);
  };

  const handleApplyArchitecture = (msg: ChatMessage) => {
    if (!msg.parsedAgents) return;
    onAgentsGenerated(
      msg.parsedAgents,
      msg.parsedAgents.length > 0 ? '新架构' : '新架构',
      '通过对话生成的架构'
    );
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Chat messages */}
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
                  : 'bg-pixel-white text-pixel-black'
                }
              `}
              style={{ boxShadow: '4px 4px 0px 0px #101010' }}
            >
              <div className="font-pixel text-sm whitespace-pre-wrap leading-relaxed">
                {msg.content}
              </div>

              {/* Apply button for assistant messages with parsed agents */}
              {msg.role === 'assistant' && msg.parsedAgents && msg.parsedAgents.length > 0 && (
                <div className="mt-3 flex gap-2">
                  <PixelButton
                    onClick={() => handleApplyArchitecture(msg)}
                    variant="primary"
                    size="sm"
                  >
                    ✅ 应用此架构
                  </PixelButton>
                </div>
              )}

              <div className={`mt-1 font-pixel text-xs ${msg.role === 'user' ? 'text-pixel-white/60' : 'text-pixel-black/40'}`}>
                {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </motion.div>
        ))}

        {/* Loading indicator */}
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-pixel-white border-4 border-pixel-black px-4 py-3" style={{ boxShadow: '4px 4px 0px 0px #101010' }}>
              <div className="flex items-center gap-2">
                <span className="font-pixel text-sm text-pixel-black">正在思考</span>
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

      {/* Examples — collapsible to save space */}
      {messages.length === 1 && !isGenerating && (
        <div className="bg-pixel-white border-4 border-pixel-black" style={{ boxShadow: '4px 4px 0px 0px #101010' }}>
          <button
            onClick={() => setShowExamples(!showExamples)}
            className="w-full px-4 py-2 font-pixel text-xs text-pixel-black/60 text-left flex items-center justify-between hover:bg-pixel-gray/30 transition-colors"
          >
            💡 选择示例快速开始
            <span className="text-lg leading-none">{showExamples ? '▲' : '▼'}</span>
          </button>
          {showExamples && (
            <div className="flex flex-col gap-2 p-4 pt-0">
              {EXAMPLE_ANSWERS.map((example, i) => (
                <motion.button
                  key={i}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleExampleClick(example, i)}
                  className={`
                    w-full p-3 border-3 border-pixel-black text-left font-pixel text-sm
                    ${selectedExample === i ? 'bg-pixel-blue text-pixel-white' : 'bg-pixel-gray text-pixel-black'}
                    transition-colors
                  `}
                >
                  {example.description}
                </motion.button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="bg-pixel-white border-4 border-pixel-black p-4" style={{ boxShadow: '4px 4px 0px 0px #101010' }}>
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="描述你想要的团队架构..."
            disabled={isGenerating}
            className="flex-1 bg-pixel-white border-4 border-pixel-black font-pixel text-sm px-4 py-3 focus:outline-none focus:border-pixel-blue disabled:bg-pixel-gray disabled:cursor-not-allowed"
          />
          <PixelButton
            onClick={handleSend}
            disabled={!input.trim() || isGenerating}
            variant="primary"
            size="md"
          >
            发送
          </PixelButton>
        </div>
      </div>
    </div>
  );
}
