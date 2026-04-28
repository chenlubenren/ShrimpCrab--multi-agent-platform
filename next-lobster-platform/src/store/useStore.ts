import { create } from 'zustand';
import { Lobster, Architecture, Message, ArchitectureAgent, OpenClawConfig, Cave } from '@/types';
import { mockLobsters, mockArchitectures, mockMessages } from '@/lib/mockData';

interface LobsterStore {
  lobsters: Lobster[];
  architectures: Architecture[];
  caves: Cave[];
  messages: Message[];
  activeLobsterId: string | null;
  activeArchitectureId: string | null;
  currentTask: string | null;
  activeAgentId: string | null;
  openclawConfigs: OpenClawConfig[];
  coins: number;
  spendCoins: (amount: number) => void;

  // Cave actions
  addCave: (cave: Cave) => void;
  removeCave: (id: string) => void;
  updateCave: (id: string, updates: Partial<Cave>) => void;

  // Lobster actions
  setLobsters: (lobsters: Lobster[]) => void;
  addLobster: (lobster: Lobster) => void;
  addMarketLobster: (lobster: Lobster) => void;
  updateLobsterStatus: (id: string, status: Lobster['status']) => void;
  setActiveLobster: (id: string | null) => void;
  addConversation: (lobsterId: string, conversation: { role: 'user' | 'lobster'; content: string }) => void;
  updateLobsterOpenClaw: (id: string, config: Partial<Lobster>) => void;
  moveLobsterToCave: (lobsterId: string, caveId: string | null) => void;

  // Architecture actions
  setArchitectures: (architectures: Architecture[]) => void;
  addArchitecture: (architecture: Architecture) => void;
  setActiveArchitecture: (id: string | null) => void;
  setActiveAgent: (agentId: string | null) => void;
  updateAgentStatus: (archId: string, agentId: string, status: ArchitectureAgent['status']) => void;
  updateAgentLink: (archId: string, agentId: string, lobsterId: string) => void;
  setCurrentTask: (task: string | null) => void;

  // OpenClaw actions
  setOpenclawConfigs: (configs: OpenClawConfig[]) => void;
  updateOpenclawConfig: (workspacePath: string, config: Partial<OpenClawConfig>) => void;

  // Message actions
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
}

export const useStore = create<LobsterStore>((set, get) => ({
  lobsters: mockLobsters,
  architectures: mockArchitectures,
  messages: mockMessages,
  caves: [
    { id: 'cave-1', name: '主窝', color: '#3b82f6', createdAt: new Date().toISOString() },
  ],
  activeLobsterId: null,
  activeArchitectureId: null,
  currentTask: null,
  activeAgentId: null,
  coins: 2500,

  spendCoins: (amount) => set((state) => ({ coins: Math.max(0, state.coins - amount) })),

  // Cave actions
  addCave: (cave) => set((state) => ({ caves: [...state.caves, cave] })),
  removeCave: (id) => set((state) => ({ caves: state.caves.filter(c => c.id !== id) })),
  updateCave: (id, updates) => set((state) => ({
    caves: state.caves.map(c => c.id === id ? { ...c, ...updates } : c)
  })),

  openclawConfigs: [
    {
      workspacePath: 'C:\\Users\\Administrator\\.openclaw\\workspace',
      port: 3001,
      isActive: true,
    },
    {
      workspacePath: 'C:\\Users\\Administrator\\.openclaw\\workspace-research-bot-td',
      port: 3002,
      isActive: true,
    }
  ],

  // Lobster actions
  setLobsters: (lobsters) => set({ lobsters }),
  addLobster: (lobster) => set((state) => ({ lobsters: [...state.lobsters, lobster] })),
  addMarketLobster: (lobster: Lobster) => set((state) => ({ lobsters: [...state.lobsters, lobster] })),
  updateLobsterStatus: (id, status) => set((state) => ({
    lobsters: state.lobsters.map(l => l.id === id ? { ...l, status } : l)
  })),
  setActiveLobster: (id) => set({ activeLobsterId: id }),
  addConversation: (lobsterId, conversation) => set((state) => ({
    lobsters: state.lobsters.map(l => {
      if (l.id === lobsterId) {
        return {
          ...l,
          conversations: [...l.conversations, {
            id: `conv-${Date.now()}`,
            ...conversation,
            timestamp: new Date().toISOString()
          }]
        };
      }
      return l;
    })
  })),
  updateLobsterOpenClaw: (id, config) => set((state) => ({
    lobsters: state.lobsters.map(l => l.id === id ? { ...l, ...config } : l)
  })),
  moveLobsterToCave: (lobsterId: string, caveId: string | null) => set((state) => ({
    lobsters: state.lobsters.map(l => l.id === lobsterId ? { ...l, caveId: caveId ?? undefined } : l)
  })),

  // Architecture actions
  setArchitectures: (architectures) => set({ architectures }),
  addArchitecture: (architecture) => set((state) => ({
    architectures: [...state.architectures, architecture]
  })),
  setActiveArchitecture: (id) => set({ activeArchitectureId: id }),
  setActiveAgent: (agentId) => set({ activeAgentId: agentId }),
  updateAgentStatus: (archId, agentId, status) => set((state) => ({
    architectures: state.architectures.map(arch => {
      if (arch.id === archId) {
        return {
          ...arch,
          agents: arch.agents.map(agent =>
            agent.id === agentId ? { ...agent, status } : agent
          )
        };
      }
      return arch;
    })
  })),
  updateAgentLink: (archId, agentId, lobsterId) => set((state) => ({
    architectures: state.architectures.map(arch => {
      if (arch.id === archId) {
        return {
          ...arch,
          agents: arch.agents.map(agent =>
            agent.id === agentId ? { ...agent, linkedLobsterId: lobsterId } : agent
          )
        };
      }
      return arch;
    })
  })),
  setCurrentTask: (task) => set({ currentTask: task }),

  // OpenClaw actions
  setOpenclawConfigs: (configs) => set({ openclawConfigs: configs }),
  updateOpenclawConfig: (workspacePath, config) => set((state) => ({
    openclawConfigs: state.openclawConfigs.map(c =>
      c.workspacePath === workspacePath ? { ...c, ...config } : c
    )
  })),

  // Message actions
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
}));
