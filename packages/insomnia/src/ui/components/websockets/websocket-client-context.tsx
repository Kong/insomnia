import React, { createContext, FC, ReactNode, useContext } from 'react';

interface WebSocketClient {
  create: typeof window.main.webSocketConnection.create;
  close: typeof window.main.webSocketConnection.close;
  send: typeof window.main.webSocketConnection.event.send;
  onReadyState: typeof window.main.webSocketConnection.readyState.subscribe;
}
export function createWebSocketClient(): WebSocketClient {
  return {
    create: window.main.webSocketConnection.create,
    close: window.main.webSocketConnection.close,
    send: window.main.webSocketConnection.event.send,
    onReadyState: window.main.webSocketConnection.readyState.subscribe,
  };
}
export const WebSocketClientContext = createContext<WebSocketClient | undefined>(undefined);
interface Props {
  client: WebSocketClient;
  children: ReactNode;
}
export const WebSocketClientProvider: FC<Props> = ({ client, children }) => {
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
