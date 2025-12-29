import { useEffect, useState } from 'react';

export type McpServerStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface McpServerState {
  status: McpServerStatus;
  port?: number;
  error?: string;
  startedAt?: number;
}

/**
 * Hook to track MCP Server status in real-time
 * Fetches initial status and listens for status changes via IPC
 */
export function useMcpServerReadyState(): McpServerState {
  const [serverState, setServerState] = useState<McpServerState>({ status: 'stopped' });

  // Get initial server status
  useEffect(() => {
    let isMounted = true;
    const fn = async () => {
      try {
        const currentState = await window.main.mcpServer.getStatus();
        if (isMounted) {
          setServerState(currentState);
        }
      } catch (error) {
        console.error('[useMcpServerReadyState] Failed to get initial status:', error);
      }
    };
    fn();
    return () => {
      isMounted = false;
    };
  }, []);

  // Listen for status changes from main process
  useEffect(() => {
    let isMounted = true;
    const unsubscribe = window.main.on('mcpServer.statusChanged', (_, incomingState: McpServerState) => {
      if (isMounted) {
        setServerState(incomingState);
      }
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return serverState;
}
