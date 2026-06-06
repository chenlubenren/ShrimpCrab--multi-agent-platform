'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sessionId?: string | null;
  conversationId?: string | null;
  isToolCall?: boolean;
  toolName?: string;
  isComplete?: boolean;
  tokenUsage?: {
    input: number;
    output: number;
  };
}

export interface WebSocketMessage {
  type: 'connected' | 'session_started' | 'session_stopped' | 'agent_output' | 'message_saved' | 'session_ended' | 'error' | 'pong';
  payload?: Record<string, unknown>;
}

interface UseAgentChatOptions {
  agentId: string;
  token: string;
  conversationId?: string | null;
  wsPort?: number;
  autoConnect?: boolean;
  autoStartSession?: boolean;
}

interface UseAgentChatReturn {
  isConnected: boolean;
  isSessionActive: boolean;
  messages: AgentChatMessage[];
  error: string | null;
  currentSessionId: string | null;
  currentConversationId: string | null;
  sendMessage: (content: string) => void;
  startSession: () => void;
  stopSession: () => void;
  connect: () => void;
  disconnect: () => void;
  clearMessages: () => void;
  hydrateMessages: (messages: AgentChatMessage[]) => void;
}

const WS_BASE = 'ws://localhost:3003';

export function useAgentChat({
  agentId,
  token,
  conversationId,
  wsPort = 3003,
  autoConnect = true,
  autoStartSession = true,
}: UseAgentChatOptions): UseAgentChatReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(conversationId || null);
  const sessionStartedRef = useRef(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const hydrateMessages = useCallback((nextMessages: AgentChatMessage[]) => {
    setMessages(nextMessages);
  }, []);

  const connect = useCallback(() => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    const params = new URLSearchParams({
      token,
      agentId,
    });
    if (conversationId) {
      params.set('conversationId', conversationId);
    }
    const wsUrl = `${WS_BASE}?${params.toString()}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setError(null);

      // Start ping interval
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);

      // Auto-start session if enabled
      if (autoStartSession && !sessionStartedRef.current) {
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN && !sessionStartedRef.current) {
            ws.send(JSON.stringify({ type: 'start', payload: { conversationId } }));
            sessionStartedRef.current = true;
          }
        }, 1000);
      }
    };

    ws.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        handleMessage(data);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    ws.onerror = (e) => {
      console.error('WebSocket error:', e);
      setError('连接错误');
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setIsConnected(false);
      setIsSessionActive(false);
      sessionStartedRef.current = false;

      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      // Auto reconnect on unexpected close
      if (event.code !== 1000 && event.code !== 1001) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      }
    };

    wsRef.current = ws;
  }, [agentId, token, conversationId, autoStartSession]);

  const handleMessage = useCallback((data: WebSocketMessage) => {
    switch (data.type) {
      case 'connected':
        console.log('Agent connected:', data.payload);
        break;

      case 'session_started':
        setCurrentSessionId(typeof data.payload?.sessionId === 'string' ? data.payload.sessionId : null);
        setCurrentConversationId(
          typeof data.payload?.conversationId === 'string' ? data.payload.conversationId : null
        );
        setIsSessionActive(true);
        setError(null);
        break;

      case 'session_stopped':
        setIsSessionActive(false);
        setCurrentSessionId((current) => typeof data.payload?.sessionId === 'string' ? data.payload.sessionId : current);
        break;

      case 'session_ended':
        setIsSessionActive(false);
        setCurrentSessionId((current) => typeof data.payload?.sessionId === 'string' ? data.payload.sessionId : current);
        break;

      case 'agent_output': {
        const payload = data.payload as {
          content: string;
          outputType: string;
          messageId?: string | null;
          sessionId?: string | null;
          conversationId?: string | null;
          timestamp: string;
        };
        
        // Skip empty outputs
        if (!payload.content.trim()) return;
        
        // Avoid duplicates
        const contentId = payload.messageId || `msg_${payload.timestamp}_${payload.content.slice(0, 50)}`;
        
        setMessages((prev) => {
          // Check if this message already exists
          if (prev.some((m) => m.id === contentId)) {
            return prev;
          }
          
          return [
            ...prev,
            {
              id: contentId,
              role: payload.outputType === 'error' ? 'system' : 'assistant',
              content: payload.content,
              timestamp: new Date(payload.timestamp),
              sessionId: payload.sessionId || null,
              conversationId: payload.conversationId || null,
            },
          ];
        });
        break;
      }

      case 'message_saved': {
        const payload = data.payload as {
          sessionId?: string | null;
          conversationId?: string | null;
        };
        if (payload?.sessionId) setCurrentSessionId(payload.sessionId);
        if (payload?.conversationId) setCurrentConversationId(payload.conversationId);
        break;
      }

      case 'error':
        const errorMsg = typeof data.payload === 'string' 
          ? data.payload 
          : (data.payload as { message?: string })?.message || 'Unknown error';
        setError(errorMsg);
        break;

      case 'pong':
        // Heartbeat response, do nothing
        break;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsSessionActive(false);
    sessionStartedRef.current = false;
  }, []);

  const startSession = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'start', payload: { conversationId } }));
      sessionStartedRef.current = true;
    }
  }, [conversationId]);

  const stopSession = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
    }
  }, []);

  const sendMessage = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('未连接到服务器');
      return;
    }

    if (!content.trim()) return;

    // Add user message to local state
    const userMsg: AgentChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      sessionId: currentSessionId,
      conversationId: currentConversationId || conversationId || null,
    };

    setMessages((prev) => [...prev, userMsg]);

    // Send to server
    wsRef.current.send(
      JSON.stringify({
        type: 'message',
        payload: {
          content: content.trim(),
          conversationId: currentConversationId || conversationId || undefined,
        },
      })
    );
  }, [conversationId, currentConversationId, currentSessionId]);

  useEffect(() => {
    sessionStartedRef.current = false;
    setCurrentSessionId(null);
    setCurrentConversationId(conversationId || null);
    setMessages([]);
  }, [agentId, conversationId]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && token && agentId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, token, agentId, connect, disconnect]);

  return {
    isConnected,
    isSessionActive,
    messages,
    error,
    currentSessionId,
    currentConversationId,
    sendMessage,
    startSession,
    stopSession,
    connect,
    disconnect,
    clearMessages,
    hydrateMessages,
  };
}
