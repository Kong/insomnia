import React, { createContext, ReactNode, useContext } from 'react';

interface WebSocketClient {
  create: typeof window.main.webSocketConnection.create;
  close: typeof window.main.webSocketConnection.close;
  send: typeof window.main.webSocketConnection.event.send;
  onReadyState: typeof window.main.webSocketConnection.readyState.subscribe;
}
function createWebSocketClient(): WebSocketClient {
  return {
    create: window.main.webSocketConnection.create,
    close: window.main.webSocketConnection.close,
    send: window.main.webSocketConnection.event.send,
    onReadyState: window.main.webSocketConnection.readyState.subscribe,
  };
}
const client = createWebSocketClient();
const WebSocketClientContext = createContext<WebSocketClient | undefined>(undefined);
export const WebSocketClientProvider = ({ children }: { children: ReactNode }) => {
  return (
    <WebSocketClientContext.Provider value={client}>
      {children}
    </WebSocketClientContext.Provider>
  );
};

export function useWebSocketClient(): WebSocketClient {
  const context = useContext(WebSocketClientContext);
  if (!context) {
    throw new Error('Use useWebSocketClient hook with <WebSocketClientProvider /> ');
  }

  return context;
}
