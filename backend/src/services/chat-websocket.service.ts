/**
 * WebSocket Server for Real-time Agent Chat
 */

import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { verifyToken } from '../utils/jwt.js';
import { agentRunner, type AgentPlatform } from './agent-runner.service.js';
import { getDb } from '../db/index.js';
import {
  userAgentInstances,
  conversations,
  messages as conversationMessages,
  providers,
  type Conversation,
} from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import {
  addMessage,
  createConversation,
  getConversationById,
  readAgentUserConfig,
} from './agent.service.js';
import {
  executeCozeAgentTurn,
  type CozeChatHistoryMessage,
} from './coze-market.service.js';
import { buildAgentRuntimePrompt } from './agent-runtime-context.service.js';
import { workflowExecutor, type WorkflowEventDelta } from './workflow-executor.service.js';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  sessionId?: string;
  agentId?: string;
  conversationId?: string;
  isAlive?: boolean;
  channel?: 'chat' | 'workflow';
  projectId?: string;
}

interface ChatMessage {
  type: 'message' | 'start' | 'stop' | 'ping' | 'pong';
  payload?: string | Record<string, unknown>;
}

interface RuntimeProviderConfig {
  apiKey: string;
  baseUrl?: string;
  models?: string[];
  stateDir?: string | null;
  providerType?: string;
}

type RuntimeAgentPlatform = AgentPlatform | 'coze';

function normalizeModelId(model: unknown): string {
  if (typeof model === 'string') return model;
  if (model && typeof model === 'object') {
    const value = model as { id?: unknown; name?: unknown };
    if (typeof value.id === 'string') return value.id;
    if (typeof value.name === 'string') return value.name;
  }
  return '';
}

function parseProviderModels(rawModels?: string | null): string[] {
  if (!rawModels) return [];
  try {
    const parsed = JSON.parse(rawModels);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeModelId).filter(Boolean);
  } catch {
    return [];
  }
}

function preferSelectedModel(models: string[] | undefined, selectedModel?: string): string[] | undefined {
  const cleanedModels = (models || []).filter(Boolean);
  const model = selectedModel?.trim();
  if (!model) return cleanedModels.length > 0 ? cleanedModels : undefined;
  if (cleanedModels.length > 0 && !cleanedModels.includes(model)) {
    return cleanedModels;
  }
  return [model, ...cleanedModels.filter((item) => item !== model)];
}

const SUPPORTED_AGENT_PLATFORMS: RuntimeAgentPlatform[] = [
  'claude-code',
  'openclaw',
  'codex',
  'hermes',
  'opencode',
  'coze',
];

class ChatWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();
  private sessionConversations: Map<string, string> = new Map();
  private isShuttingDown = false;

  constructor(port: number = 3003) {
    this.wss = new WebSocketServer({ port });
    this.wss.on('listening', () => {
      console.log(`WebSocket server running on ws://localhost:${port}`);
    });
    this.wss.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`WebSocket port ${port} is already in use. Stop the old backend process and restart.`);
      } else {
        console.error('WebSocket server error:', error);
      }
      process.exit(1);
    });
    this.setupServer();
    console.log(`🔌 WebSocket server running on ws://localhost:${port}`);
  }

  private setupServer(): void {
    // Handle new connections
    this.wss.on('connection', (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    // Heartbeat to detect dead connections
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        const authWs = ws as AuthenticatedWebSocket;
        if (authWs.isAlive === false) {
          return authWs.terminate();
        }
        authWs.isAlive = false;
        authWs.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });

    // Set up agent runner event listeners
    this.setupAgentEvents();
    this.setupWorkflowEvents();
  }

  private setupWorkflowEvents(): void {
    workflowExecutor.on('workflowEvent', (delta: WorkflowEventDelta) => {
      this.clients.forEach((ws) => {
        if (ws.channel !== 'workflow') return;
        if (ws.userId !== delta.userId) return;
        if (ws.projectId && delta.projectId && ws.projectId !== delta.projectId) return;
        this.sendToClient(ws, { type: 'workflow_event', payload: delta });
      });
    });
  }

  private async handleConnection(ws: AuthenticatedWebSocket, req: IncomingMessage): Promise<void> {
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Extract token from query string
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const agentId = url.searchParams.get('agentId');
    const requestedConversationId = url.searchParams.get('conversationId') || undefined;

    if (!token) {
      ws.close(4001, 'Missing authentication token');
      return;
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      ws.close(4002, 'Invalid token');
      return;
    }

    ws.userId = decoded.userId;

    const channel = url.searchParams.get('channel');
    if (channel === 'workflow') {
      ws.channel = 'workflow';
      ws.projectId = url.searchParams.get('projectId') || undefined;

      const clientKey = `wf:${decoded.userId}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
      this.clients.set(clientKey, ws);
      console.log(`Workflow channel client connected: ${clientKey}`);

      this.sendToClient(ws, {
        type: 'connected',
        payload: {
          channel: 'workflow',
          projectId: ws.projectId || null,
          status: 'ready',
        },
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg?.type === 'ping') {
            this.sendToClient(ws, { type: 'pong' });
          }
        } catch {
          // Ignore malformed workflow-channel messages.
        }
      });

      ws.on('close', () => {
        console.log(`Workflow channel client disconnected: ${clientKey}`);
        this.clients.delete(clientKey);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for ${clientKey}:`, error);
      });
      return;
    }

    ws.channel = 'chat';

    if (!agentId) {
      ws.close(4003, 'Missing agent ID');
      return;
    }

    // Verify user owns this agent
    const db = getDb();
    const agent = db
      .select()
      .from(userAgentInstances)
      .where(
        and(
          eq(userAgentInstances.id, agentId),
          eq(userAgentInstances.userId, decoded.userId)
        )
      )
      .get();

    if (!agent) {
      ws.close(4004, 'Agent not found or unauthorized');
      return;
    }

    ws.agentId = agentId;
    if (requestedConversationId) {
      const conversation = await getConversationById(requestedConversationId, decoded.userId);
      if (!conversation || conversation.agentInstanceId !== agentId) {
        ws.close(4005, 'Conversation not found or unauthorized');
        return;
      }
      ws.conversationId = requestedConversationId;
      if (conversation.sessionId) {
        ws.sessionId = conversation.sessionId;
      }
    }

    const clientKey = `${decoded.userId}:${agentId}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    this.clients.set(clientKey, ws);

    console.log(`✅ Client connected: ${clientKey}`);

    // Send connection success
    this.sendToClient(ws, {
      type: 'connected',
      payload: {
        agentId,
        agentName: agent.name,
        platform: this.getPlatformFromManifest(agent.manifest),
        conversationId: ws.conversationId || null,
        sessionId: ws.sessionId || null,
        status: 'ready',
      },
    });

    // Handle messages
    ws.on('message', async (data) => {
      try {
        const msg: ChatMessage = JSON.parse(data.toString());
        await this.handleMessage(ws, msg);
      } catch (error) {
        console.error('Failed to parse message:', error);
        this.sendToClient(ws, { type: 'error', payload: 'Invalid message format' });
      }
    });

    ws.on('close', () => {
      console.log(`❌ Client disconnected: ${clientKey}`);
      this.clients.delete(clientKey);
      
      // Optionally stop the agent session
      const session = agentRunner.getSessionByAgentId(agentId!);
      if (session) {
        // Keep session alive for a bit in case user reconnects
      }
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for ${clientKey}:`, error);
    });
  }

  private async handleMessage(ws: AuthenticatedWebSocket, msg: ChatMessage): Promise<void> {
    const { userId, agentId } = ws;

    if (!userId || !agentId) {
      this.sendToClient(ws, { type: 'error', payload: 'Not authenticated' });
      return;
    }

    switch (msg.type) {
      case 'start':
        await this.handleStartSession(ws, agentId, msg.payload);
        break;

      case 'stop':
        await this.handleStopSession(ws, agentId);
        break;

      case 'message':
        await this.handleChatMessage(ws, agentId, msg.payload);
        break;

      case 'ping':
        this.sendToClient(ws, { type: 'pong' });
        break;

      default:
        this.sendToClient(ws, { type: 'error', payload: 'Unknown message type' });
    }
  }

  private getRuntimeConfig(agentId: string): {
    agent: typeof userAgentInstances.$inferSelect;
    platform: RuntimeAgentPlatform;
    providerConfig?: RuntimeProviderConfig;
  } | null {
    const db = getDb();
    const agent = db
      .select()
      .from(userAgentInstances)
      .where(eq(userAgentInstances.id, agentId))
      .get();

    if (!agent) return null;

    const platform = this.getPlatformFromManifest(agent.manifest) || 'openclaw';
    const userConfig = readAgentUserConfig(agent);
    const selectedModel = typeof userConfig.model === 'string' ? userConfig.model : undefined;
    let providerConfig: RuntimeProviderConfig | undefined;

    if (agent.providerId) {
      const provider = db
        .select()
        .from(providers)
        .where(eq(providers.id, agent.providerId))
        .get();

      if (provider) {
        const modelIds = parseProviderModels(provider.models);
        providerConfig = {
          apiKey: provider.apiKey,
          baseUrl: provider.baseUrl || undefined,
          models: preferSelectedModel(modelIds, selectedModel),
          stateDir: agent.stateDir,
          providerType: provider.type,
        };
      }
    }

    return { agent, platform, providerConfig };
  }

  private getPayloadRecord(payload: ChatMessage['payload']): Record<string, unknown> | null {
    return payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : null;
  }

  private getConversationIdFromPayload(payload: ChatMessage['payload']): string | undefined {
    const record = this.getPayloadRecord(payload);
    return typeof record?.conversationId === 'string' && record.conversationId.trim()
      ? record.conversationId.trim()
      : undefined;
  }

  private getMessageContent(payload: ChatMessage['payload']): string {
    if (typeof payload === 'string') return payload;
    const record = this.getPayloadRecord(payload);
    return typeof record?.content === 'string' ? record.content : '';
  }

  private async getOrCreateConversation(
    ws: AuthenticatedWebSocket,
    agentId: string,
    payload?: ChatMessage['payload'],
    title?: string
  ): Promise<Conversation | null> {
    const userId = ws.userId!;
    const requestedConversationId = this.getConversationIdFromPayload(payload) || ws.conversationId;

    if (requestedConversationId) {
      const conversation = await getConversationById(requestedConversationId, userId);
      if (!conversation || conversation.agentInstanceId !== agentId) {
        this.sendToClient(ws, { type: 'error', payload: 'Conversation not found or unauthorized' });
        return null;
      }

      ws.conversationId = conversation.id;
      if (conversation.sessionId) {
        ws.sessionId = conversation.sessionId;
      } else {
        ws.sessionId = undefined;
      }
      return conversation;
    }

    const conversation = await createConversation(userId, agentId, title || 'New session');
    ws.conversationId = conversation.id;
    return conversation;
  }

  private updateConversationSession(conversationId: string, sessionId: string): void {
    const db = getDb();
    db.update(conversations)
      .set({ sessionId, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId))
      .run();
    this.sessionConversations.set(sessionId, conversationId);
  }

  private isCliPlatform(platform: RuntimeAgentPlatform): platform is AgentPlatform {
    return platform !== 'coze';
  }

  private ensureCozeSession(ws: AuthenticatedWebSocket, conversation: Conversation): string {
    const sessionId = ws.sessionId?.startsWith('coze_')
      ? ws.sessionId
      : conversation.sessionId?.startsWith('coze_')
        ? conversation.sessionId
        : `coze_${conversation.id}`;

    if (conversation.sessionId !== sessionId) {
      this.updateConversationSession(conversation.id, sessionId);
    } else {
      this.sessionConversations.set(sessionId, conversation.id);
    }

    ws.sessionId = sessionId;
    ws.conversationId = conversation.id;
    return sessionId;
  }

  private getCozeHistory(conversationId: string): CozeChatHistoryMessage[] {
    const db = getDb();
    const rows = db
      .select({
        role: conversationMessages.role,
        content: conversationMessages.content,
      })
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(conversationMessages.createdAt)
      .all();

    return rows
      .filter((message): message is { role: 'user' | 'assistant'; content: string } =>
        (message.role === 'user' || message.role === 'assistant') && message.content.trim().length > 0
      )
      .slice(-18);
  }

  private async getOrStartRunnerSession(
    ws: AuthenticatedWebSocket,
    runtime: NonNullable<ReturnType<ChatWebSocketServer['getRuntimeConfig']>>,
    conversation: Conversation
  ) {
    if (!this.isCliPlatform(runtime.platform)) {
      throw new Error(`${runtime.platform} does not use a local CLI session`);
    }

    let session = conversation.sessionId ? agentRunner.getSession(conversation.sessionId) : undefined;

    if (session && (session.status === 'stopped' || session.status === 'error' || session.platform !== runtime.platform)) {
      await agentRunner.stopSession(session.sessionId);
      session = undefined;
    }

    if (!session) {
      session = await agentRunner.startSession(
        runtime.agent.id,
        runtime.platform,
        runtime.agent.workspacePath,
        runtime.providerConfig
      );
      this.updateConversationSession(conversation.id, session.sessionId);
    } else {
      session.providerConfig = runtime.providerConfig;
      this.sessionConversations.set(session.sessionId, conversation.id);
    }

    ws.sessionId = session.sessionId;
    ws.conversationId = conversation.id;
    return session;
  }

  private async handleStartSession(
    ws: AuthenticatedWebSocket,
    agentId: string,
    payload?: ChatMessage['payload']
  ): Promise<void> {
    const runtime = this.getRuntimeConfig(agentId);

    if (!runtime) {
      this.sendToClient(ws, { type: 'error', payload: 'Agent not found' });
      return;
    }

    const conversation = await this.getOrCreateConversation(ws, agentId, payload);
    if (!conversation) return;

    try {
      if (runtime.platform === 'coze') {
        const sessionId = this.ensureCozeSession(ws, conversation);

        const db = getDb();
        db.update(userAgentInstances)
          .set({ status: 'idle', lastActiveAt: new Date(), updatedAt: new Date() })
          .where(eq(userAgentInstances.id, agentId))
          .run();

        this.sendToClient(ws, {
          type: 'session_started',
          payload: {
            sessionId,
            conversationId: conversation.id,
            platform: runtime.platform,
          },
        });
        return;
      }

      const session = await this.getOrStartRunnerSession(ws, runtime, conversation);

      // Update agent status
      const db = getDb();
      db.update(userAgentInstances)
        .set({ status: 'busy', lastActiveAt: new Date(), updatedAt: new Date() })
        .where(eq(userAgentInstances.id, agentId))
        .run();

      this.sendToClient(ws, {
        type: 'session_started',
        payload: {
          sessionId: session.sessionId,
          conversationId: conversation.id,
          platform: session.platform,
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to start session';
      this.sendToClient(ws, { type: 'error', payload: errorMsg });
    }
  }

  private async handleStopSession(ws: AuthenticatedWebSocket, agentId: string): Promise<void> {
    const session = ws.sessionId ? agentRunner.getSession(ws.sessionId) : undefined;

    if (session) {
      await agentRunner.stopSession(session.sessionId);
    }

    const db = getDb();
    db.update(userAgentInstances)
      .set({ status: 'idle', updatedAt: new Date() })
      .where(eq(userAgentInstances.id, agentId))
      .run();

    this.sendToClient(ws, {
      type: 'session_stopped',
      payload: { agentId, conversationId: ws.conversationId || null, sessionId: ws.sessionId || null },
    });
  }

  private async handleChatMessage(
    ws: AuthenticatedWebSocket,
    agentId: string,
    payload: ChatMessage['payload']
  ): Promise<void> {
    const content = this.getMessageContent(payload);
    if (!content?.trim()) {
      this.sendToClient(ws, { type: 'error', payload: 'Empty message' });
      return;
    }

    const runtime = this.getRuntimeConfig(agentId);
    if (!runtime) {
      this.sendToClient(ws, { type: 'error', payload: 'Agent not found' });
      return;
    }

    const conversation = await this.getOrCreateConversation(
      ws,
      agentId,
      payload,
      content.substring(0, 40) || 'New session'
    );
    if (!conversation) return;

    if (runtime.platform === 'coze') {
      await this.handleCozeChatMessage(ws, runtime, conversation, content);
      return;
    }

    let session;
    try {
      session = await this.getOrStartRunnerSession(ws, runtime, conversation);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to start agent';
      this.sendToClient(ws, { type: 'error', payload: errorMsg });
      return;
    }

    const userMessage = await addMessage(conversation.id, 'user', content, {
      source: 'websocket',
      sessionId: session.sessionId,
      conversationId: conversation.id,
    });

    const runtimeContent = buildAgentRuntimePrompt(runtime.agent, {
      userMessage: content,
      mode: 'direct-chat',
      platform: runtime.platform,
      providerConfig: runtime.providerConfig,
      extraInstructions: [
        `Conversation id: ${conversation.id}`,
        `Runner session id: ${session.sessionId}`,
        'The saved user message is the content inside [USER_MESSAGE]. Do not treat the runtime context as user-authored text.',
      ],
    });

    // Send message to agent
    const sent = agentRunner.sendMessage(session.sessionId, runtimeContent);

    if (!sent) {
      this.sendToClient(ws, { type: 'error', payload: 'Failed to send message to agent' });
      return;
    }

    this.sendToClient(ws, {
      type: 'message_saved',
      payload: {
        messageId: userMessage.id,
        conversationId: conversation.id,
        sessionId: session.sessionId,
      },
    });
  }

  private async handleCozeChatMessage(
    ws: AuthenticatedWebSocket,
    runtime: NonNullable<ReturnType<ChatWebSocketServer['getRuntimeConfig']>>,
    conversation: Conversation,
    content: string
  ): Promise<void> {
    const userId = ws.userId!;
    const sessionId = this.ensureCozeSession(ws, conversation);
    const db = getDb();

    const userMessage = await addMessage(conversation.id, 'user', content, {
      source: 'websocket',
      runtime: 'coze',
      sessionId,
      conversationId: conversation.id,
    });

    this.sendToClient(ws, {
      type: 'message_saved',
      payload: {
        messageId: userMessage.id,
        conversationId: conversation.id,
        sessionId,
      },
    });

    db.update(userAgentInstances)
      .set({ status: 'busy', lastActiveAt: new Date(), updatedAt: new Date() })
      .where(eq(userAgentInstances.id, runtime.agent.id))
      .run();

    try {
      const history = this.getCozeHistory(conversation.id);
      const runtimeContent = buildAgentRuntimePrompt(runtime.agent, {
        userMessage: content,
        mode: 'direct-chat',
        platform: runtime.platform,
        extraInstructions: [
          `Conversation id: ${conversation.id}`,
          `Runner session id: ${sessionId}`,
          'The saved user message is the content inside [USER_MESSAGE]. Do not treat the runtime context as user-authored text.',
        ],
      });
      const responseContent = await executeCozeAgentTurn(runtime.agent, {
        userId,
        conversationId: conversation.id,
        message: runtimeContent,
        history,
      });

      const savedMessage = await addMessage(conversation.id, 'assistant', responseContent, {
        source: 'coze',
        sessionId,
        conversationId: conversation.id,
        outputType: 'output',
      });

      this.sendToClient(ws, {
        type: 'agent_output',
        payload: {
          content: responseContent,
          outputType: 'output',
          sessionId,
          conversationId: conversation.id,
          messageId: savedMessage.id,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Coze Agent 调用失败';
      const savedMessage = await addMessage(conversation.id, 'system', errorMessage, {
        source: 'coze',
        sessionId,
        conversationId: conversation.id,
        outputType: 'error',
      });

      this.sendToClient(ws, {
        type: 'agent_output',
        payload: {
          content: errorMessage,
          outputType: 'error',
          sessionId,
          conversationId: conversation.id,
          messageId: savedMessage.id,
          timestamp: new Date().toISOString(),
        },
      });
    } finally {
      db.update(userAgentInstances)
        .set({ status: 'idle', updatedAt: new Date() })
        .where(eq(userAgentInstances.id, runtime.agent.id))
        .run();
    }
  }

  private setupAgentEvents(): void {
    // Forward agent responses to clients
    agentRunner.on('response', async ({ sessionId, response }) => {
      const session = agentRunner.getSession(sessionId);
      if (!session) return;
      const conversationId = this.sessionConversations.get(sessionId);
      let messageId: string | undefined;

      if (conversationId && response.content?.trim() && response.type !== 'done') {
        const savedMessage = await addMessage(
          conversationId,
          response.type === 'error' ? 'system' : 'assistant',
          response.content,
          {
            source: 'agent-runner',
            sessionId,
            conversationId,
            outputType: response.type,
          }
        );
        messageId = savedMessage.id;
      }

      for (const ws of this.clients.values()) {
        if (ws.sessionId === sessionId) {
          this.sendToClient(ws, {
            type: 'agent_output',
            payload: {
              content: response.content,
              outputType: response.type,
              sessionId,
              conversationId: conversationId || ws.conversationId || null,
              messageId: messageId || null,
              timestamp: response.timestamp.toISOString(),
            },
          });
        }
      }
    });

    agentRunner.on('sessionEnd', ({ sessionId, exitCode }) => {
      const session = agentRunner.getSession(sessionId);
      if (!session) return;

      // Update agent status
      const db = getDb();
      db.update(userAgentInstances)
        .set({ status: 'idle', updatedAt: new Date() })
        .where(eq(userAgentInstances.id, session.agentId))
        .run();

      // Notify client
      const conversationId = this.sessionConversations.get(sessionId);
      for (const ws of this.clients.values()) {
        if (ws.sessionId === sessionId) {
          this.sendToClient(ws, {
            type: 'session_ended',
            payload: { exitCode, sessionId, conversationId: conversationId || null },
          });
        }
      }
      this.sessionConversations.delete(sessionId);
    });
  }

  private sendToClient(ws: AuthenticatedWebSocket, data: Record<string, unknown>): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  private getPlatformFromManifest(manifestJson: string): RuntimeAgentPlatform | null {
    try {
      const manifest = JSON.parse(manifestJson);
      const type = manifest?.entrypoint?.type;
      return SUPPORTED_AGENT_PLATFORMS.includes(type) ? type : null;
    } catch {
      return null;
    }
  }

  /**
   * Broadcast to all clients
   */
  broadcast(data: Record<string, unknown>): void {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Shutdown server
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    // Stop all agent sessions
    await agentRunner.stopAll();

    // Close all connections
    this.wss.clients.forEach((client) => {
      client.terminate();
    });

    await new Promise<void>((resolve, reject) => {
      this.wss.close((error?: Error) => {
        if (error && !error.message.includes('not running')) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    this.clients.clear();
    this.sessionConversations.clear();
    chatServer = null;
    console.log('WebSocket server shut down');
  }
}

// Singleton instance
let chatServer: ChatWebSocketServer | null = null;

export function startChatServer(port?: number): ChatWebSocketServer {
  if (!chatServer) {
    chatServer = new ChatWebSocketServer(port);
  }
  return chatServer;
}

export function getChatServer(): ChatWebSocketServer | null {
  return chatServer;
}

export default chatServer;
