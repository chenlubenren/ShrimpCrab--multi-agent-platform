export interface Lobster {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'working' | 'busy';
  avatar?: string;
  createdAt: string;
  conversations: Conversation[];
  caveId?: string; // which cave this lobster belongs to
  // OpenClaw configuration
  openclawPath?: string;
  openclawPort?: number;
  isConnected?: boolean;
  sessionKey?: string;
}

export interface Conversation {
  id: string;
  role: 'user' | 'lobster';
  content: string;
  timestamp: string;
}

export interface ArchitectureNode {
  id: string;
  type: string;
  position?: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface ArchitectureEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  /** React Flow 源端口 id，如条件节点的「否」为 `no` */
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface Architecture {
  id: string;
  name: string;
  description: string;
  agents: ArchitectureAgent[];
  nodes?: ArchitectureNode[];
  edges?: ArchitectureEdge[];
  createdAt: string;
}

export interface ArchitectureAgent {
  id: string;
  name: string;
  role: string;
  status: 'standby' | 'active' | 'executing';
  isManager?: boolean;
  // Input/Output ports for node connections
  inputs?: string[];
  outputs?: string[];
  // OpenClaw integration
  linkedLobsterId?: string;
  openclawPath?: string;
  openclawPort?: number;
}

export type CreateMode = 'canvas' | 'chat';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
}

export interface OpenClawConfig {
  workspacePath: string;
  port: number;
  isActive: boolean;
  sessionKey?: string;
}

export interface Cave {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}
