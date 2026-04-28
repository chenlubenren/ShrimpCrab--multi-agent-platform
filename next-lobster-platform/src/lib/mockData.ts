import { Lobster, Architecture, Conversation, Message } from '@/types';

export const mockLobsters: Lobster[] = [
  {
    id: 'lobster-001',
    name: 'research-bot-manager',
    role: 'Research swarm coordinator via OpenClaw gateway',
    status: 'idle',
    openclawPath: 'C:\\Users\\Administrator\\.openclaw\\workspace-research-bot-manager',
    openclawPort: 3001,
    isConnected: true,
    createdAt: '2026-03-01',
    conversations: [
      {
        id: 'conv-001',
        role: 'lobster',
        content: 'Hi! I am research-bot-manager, coordinating dictator, td, and writer through OpenClaw.',
        timestamp: '2026-03-01 10:00:00'
      }
    ]
  },
  {
    id: 'lobster-002',
    name: 'Research Specialist',
    role: 'Research planning & methodology',
    status: 'idle',
    openclawPath: 'C:\\Users\\Administrator\\.openclaw\\workspace-research-bot-td',
    openclawPort: 3002,
    isConnected: true,
    createdAt: '2026-03-05',
    conversations: [
      {
        id: 'conv-002',
        role: 'lobster',
        content: 'Hello! I am Research Specialist, focused on research planning and methodology.',
        timestamp: '2026-03-05 14:30:00'
      }
    ]
  },
  {
    id: 'lobster-003',
    name: 'Data Analyst',
    role: 'Experiments & data analysis',
    status: 'busy',
    createdAt: '2026-03-10',
    conversations: [
      {
        id: 'conv-003',
        role: 'lobster',
        content: 'I am Data Analyst, skilled at running analyses and experiments. Let me help you interpret the results!',
        timestamp: '2026-03-10 09:15:00'
      }
    ]
  },
  {
    id: 'lobster-004',
    name: 'Research Writor',
    role: 'Papers & documentation',
    status: 'idle',
    createdAt: '2026-03-12',
    conversations: [
      {
        id: 'conv-004',
        role: 'lobster',
        content: 'Hi! I am Research Writor — I turn findings into clear papers and documentation.',
        timestamp: '2026-03-12 11:00:00'
      }
    ]
  }
];

export const mockArchitectures: Architecture[] = [
  {
    id: 'arch-001',
    name: 'Academic Team',
    description:
      'research-bot-manager receives tasks and coordinates the research swarm. Research Specialist plans research. Data Analyst runs experiments. Research Writor completes papers.',
    createdAt: '2026-03-15',
    agents: [
      {
        id: 'agent-mgr',
        name: '项目经理',
        role: '协调后续agent',
        status: 'standby',
        isManager: true,
        linkedLobsterId: 'lobster-001',
        openclawPath: 'C:\\Users\\Administrator\\.openclaw\\workspace-research-bot-manager',
        openclawPort: 3001
      },
      {
        id: 'agent-1',
        name: '科研方案制定',
        role: '拟定研究思路与技术路线',
        status: 'standby',
        linkedLobsterId: 'lobster-002',
        openclawPath: 'C:\\Users\\Administrator\\.openclaw\\workspace-research-bot-td',
        openclawPort: 3002
      },
      {
        id: 'agent-2',
        name: '实验方案执行',
        role: '执行实验与数据分析',
        status: 'standby',
        linkedLobsterId: 'lobster-003'
      },
      {
        id: 'agent-3',
        name: '论文撰写',
        role: '文稿与论文输出',
        status: 'standby',
        linkedLobsterId: 'lobster-004'
      }
    ]
  },
  {
    id: 'arch-002',
    name: 'Creative Workshop',
    description: 'A team focused on creative content generation',
    createdAt: '2026-03-18',
    agents: [
      { id: 'agent-mgr-2', name: 'Creative Director', role: 'Creative Direction', status: 'standby', isManager: true },
      { id: 'agent-4', name: 'Inspiration Collector', role: 'Material Collection', status: 'standby' },
      { id: 'agent-5', name: 'Designer', role: 'Visual Design', status: 'standby' }
    ]
  }
];

export const mockMessages: Message[] = [
  {
    id: 'msg-001',
    senderId: 'arch-001',
    senderName: 'Academic Team',
    content: 'Welcome to Academic Team! Enter your research task and I will coordinate the team to complete it.',
    timestamp: '2026-03-15 08:00:00'
  }
];
