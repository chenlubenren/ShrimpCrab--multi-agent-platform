// OpenClaw Gateway API Integration
// Gateway runs on port 18789 with token auth

const GATEWAY_PORT = 18789;
const GATEWAY_TOKEN = '6bc14a18ebb4079a6fb4e6b582256e38dee11a70493f1167';
const GATEWAY_BASE = `http://127.0.0.1:${GATEWAY_PORT}`;

export interface OpenClawMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface OpenClawSession {
  key: string;
  sessionId: string;
  status: string;
  lastMessage?: string;
  updatedAt: number;
}

export interface OpenClawTaskResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: unknown;
}

// Helper to make authenticated requests to OpenClaw Gateway
async function gatewayRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const headers = {
    'Authorization': `Bearer ${GATEWAY_TOKEN}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  return fetch(`${GATEWAY_BASE}${endpoint}`, {
    ...options,
    headers,
  });
}

// Get gateway status
export async function checkGatewayStatus(): Promise<{ connected: boolean; version?: string }> {
  try {
    const response = await gatewayRequest('/status', {
      method: 'GET',
    });
    
    if (response.ok) {
      const data = await response.json();
      return { connected: true, version: data.version };
    }
    return { connected: false };
  } catch (error) {
    console.error('[OpenClaw Gateway] Status check failed:', error);
    return { connected: false };
  }
}

// List active sessions
export async function listSessions(activeMinutes: number = 30): Promise<OpenClawSession[]> {
  try {
    const response = await gatewayRequest('/sessions/list', {
      method: 'POST',
      body: JSON.stringify({ activeMinutes }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.sessions || [];
    }
    
    console.error('[OpenClaw Gateway] List sessions failed:', response.status);
    return [];
  } catch (error) {
    console.error('[OpenClaw Gateway] List sessions error:', error);
    return [];
  }
}

// Send message to a specific session
export async function sendToSession(
  sessionKey: string,
  message: string
): Promise<OpenClawTaskResult> {
  try {
    const response = await gatewayRequest('/sessions/send', {
      method: 'POST',
      body: JSON.stringify({
        sessionKey,
        message,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: 'Message sent successfully',
        data,
      };
    }

    const errorText = await response.text();
    return {
      success: false,
      error: `Failed to send message: ${response.status} - ${errorText}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Get session history
export async function getSessionHistory(
  sessionKey: string,
  limit: number = 50
): Promise<OpenClawMessage[]> {
  try {
    const response = await gatewayRequest('/sessions/history', {
      method: 'POST',
      body: JSON.stringify({
        sessionKey,
        limit,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.messages || [];
    }
    
    return [];
  } catch (error) {
    console.error('[OpenClaw Gateway] Get history error:', error);
    return [];
  }
}

// Spawn a new background task/agent
export async function spawnTask(
  task: string,
  label: string,
  options: {
    model?: string;
    workspace?: string;
    background?: boolean;
  } = {}
): Promise<OpenClawTaskResult> {
  try {
    const response = await gatewayRequest('/sessions/spawn', {
      method: 'POST',
      body: JSON.stringify({
        task,
        label,
        ...options,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: `Spawned task: ${label}`,
        data,
      };
    }

    const errorText = await response.text();
    return {
      success: false,
      error: `Failed to spawn task: ${response.status} - ${errorText}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Get session status
export async function getSessionStatus(sessionKey: string): Promise<{
  status: string;
  startedAt?: number;
  endedAt?: number;
} | null> {
  try {
    const response = await gatewayRequest('/sessions/status', {
      method: 'POST',
      body: JSON.stringify({ sessionKey }),
    });

    if (response.ok) {
      return await response.json();
    }
    
    return null;
  } catch (error) {
    console.error('[OpenClaw Gateway] Status error:', error);
    return null;
  }
}

// Main function to send task to an agent by workspace path
export async function sendToOpenClawAgent(
  task: string,
  workspacePath: string,
  agentId?: string
): Promise<OpenClawTaskResult> {
  try {
    // Build the task message with context
    const taskMessage = `[Architecture Task Request]
Task: ${task}
Workspace: ${workspacePath}
Agent: ${agentId || 'default'}
Timestamp: ${new Date().toISOString()}

Please execute this task and report back the results.`;

    // Try to send to the main session for this workspace
    const sessionKey = `agent:${workspacePath.split('\\').pop()}:main`;
    
    const result = await sendToSession(sessionKey, taskMessage);
    
    if (result.success) {
      return {
        success: true,
        message: `Task sent to ${workspacePath}`,
        data: { sessionKey },
      };
    }

    // If direct session fails, try spawning a new task
    return await spawnTask(task, `arch-task-${Date.now()}`, {
      workspace: workspacePath,
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Legacy function for backward compatibility
export async function sendToOpenClaw(
  message: string,
  workspacePath: string,
  port?: number
): Promise<OpenClawTaskResult> {
  return sendToOpenClawAgent(message, workspacePath);
}

// Check if OpenClaw Gateway is accessible
export async function checkOpenClawStatus(): Promise<boolean> {
  const status = await checkGatewayStatus();
  return status.connected;
}
