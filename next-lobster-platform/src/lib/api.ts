import { Lobster, Architecture, Message, Conversation } from '@/types';
import { mockLobsters, mockArchitectures, mockMessages } from './mockData';

const API_BASE = 'http://localhost:3001';

// Lobster API
export async function fetchLobsters(): Promise<Lobster[]> {
  try {
    const res = await fetch(`${API_BASE}/lobsters`);
    if (!res.ok) throw new Error('Failed to fetch');
    return await res.json();
  } catch {
    return mockLobsters;
  }
}

export async function fetchLobsterById(id: string): Promise<Lobster | null> {
  try {
    const res = await fetch(`${API_BASE}/lobsters/${id}`);
    if (!res.ok) throw new Error('Failed to fetch');
    return await res.json();
  } catch {
    return mockLobsters.find(l => l.id === id) || null;
  }
}

export async function createLobster(data: Partial<Lobster>): Promise<Lobster> {
  try {
    const res = await fetch(`${API_BASE}/lobsters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create');
    return await res.json();
  } catch {
    const newLobster: Lobster = {
      id: `lobster-${Date.now()}`,
      name: data.name || '新龙虾',
      role: data.role || '通用助手',
      status: 'idle',
      createdAt: new Date().toISOString(),
      conversations: []
    };
    return newLobster;
  }
}

export async function addConversation(lobsterId: string, conversation: Omit<Conversation, 'id'>): Promise<Conversation> {
  const newConv: Conversation = {
    id: `conv-${Date.now()}`,
    ...conversation
  };
  return newConv;
}

// Architecture API
export async function fetchArchitectures(): Promise<Architecture[]> {
  try {
    const res = await fetch(`${API_BASE}/architectures`);
    if (!res.ok) throw new Error('Failed to fetch');
    return await res.json();
  } catch {
    return mockArchitectures;
  }
}

export async function fetchArchitectureById(id: string): Promise<Architecture | null> {
  try {
    const res = await fetch(`${API_BASE}/architectures/${id}`);
    if (!res.ok) throw new Error('Failed to fetch');
    return await res.json();
  } catch {
    return mockArchitectures.find(a => a.id === id) || null;
  }
}

export async function createArchitecture(data: Partial<Architecture>): Promise<Architecture> {
  try {
    const res = await fetch(`${API_BASE}/architectures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create');
    return await res.json();
  } catch {
    const newArch: Architecture = {
      id: `arch-${Date.now()}`,
      name: data.name || '新架构',
      description: data.description || '',
      agents: data.agents || [],
      createdAt: new Date().toISOString()
    };
    return newArch;
  }
}

export async function updateArchitectureStatus(archId: string, agentId: string, status: 'standby' | 'active' | 'executing'): Promise<void> {
  // Mock implementation - in real app would call API
  console.log(`Updating ${agentId} in ${archId} to ${status}`);
}

// Messages API
export async function fetchMessages(): Promise<Message[]> {
  try {
    const res = await fetch(`${API_BASE}/messages`);
    if (!res.ok) throw new Error('Failed to fetch');
    return await res.json();
  } catch {
    return mockMessages;
  }
}

export async function sendMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
  try {
    const res = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
    if (!res.ok) throw new Error('Failed to send');
    return await res.json();
  } catch {
    return {
      id: `msg-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...message
    };
  }
}
