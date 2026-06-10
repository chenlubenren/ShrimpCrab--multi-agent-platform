'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { wsUrl } from '@/lib/runtime';
import type { WorkflowEventDelta } from '@/types';

interface UseWorkflowEventsOptions {
  token: string | null;
  projectId: string;
  /** Called for every workflow event delta received over WS. */
  onEvent?: (delta: WorkflowEventDelta) => void;
  enabled?: boolean;
}

interface UseWorkflowEventsReturn {
  isConnected: boolean;
  lastDelta: WorkflowEventDelta | null;
}

const RECONNECT_DELAY_MS = 3000;
const PING_INTERVAL_MS = 25000;

/**
 * Subscribes to the project's workflow execution event stream over WebSocket
 * (channel=workflow). Falls back gracefully: callers should keep polling when
 * `isConnected` is false.
 */
export function useWorkflowEvents({
  token,
  projectId,
  onEvent,
  enabled = true,
}: UseWorkflowEventsOptions): UseWorkflowEventsReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastDelta, setLastDelta] = useState<WorkflowEventDelta | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const cleanup = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (pingRef.current) {
      clearInterval(pingRef.current);
      pingRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (!enabled || !token || !projectId) {
      cleanup();
      return;
    }

    let disposed = false;

    const connect = () => {
      if (disposed) return;
      if (
        wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING
      ) {
        return;
      }

      const params = new URLSearchParams({
        token,
        channel: 'workflow',
        projectId,
      });
      const ws = new WebSocket(wsUrl(params));
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) return;
        setIsConnected(true);
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, PING_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        if (disposed) return;
        try {
          const data = JSON.parse(event.data);
          if (data?.type === 'workflow_event' && data.payload) {
            const delta = data.payload as WorkflowEventDelta;
            setLastDelta(delta);
            onEventRef.current?.(delta);
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = (event) => {
        if (disposed) return;
        setIsConnected(false);
        if (pingRef.current) {
          clearInterval(pingRef.current);
          pingRef.current = null;
        }
        if (event.code !== 1000 && event.code !== 1001) {
          reconnectRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };

      ws.onerror = () => {
        // onclose will fire and schedule reconnection
      };
    };

    connect();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [enabled, token, projectId, cleanup]);

  return { isConnected, lastDelta };
}
