import React, { createContext, FC, ReactNode, useContext } from 'react';

const WebSocketClientContext = createContext<WebSocketClient | undefined>(undefined);
interface Props {
  client: WebSocketClient;
  children: ReactNode;
}
/**
 * This Context is created to separate WebSocket interfaces provided by the electron ipc bridge without having to directly read from the preload.
 * Such abstraction allows unit-testing the behaviours of UI components without having to deal with the electron interface or websocket.
 */
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
export interface WebSocketClient {
  event: typeof window.main.webSocketConnection.event;
  create: typeof window.main.webSocketConnection.create;
  close: typeof window.main.webSocketConnection.close;
  send: typeof window.main.webSocketConnection.event.send;
  onReadyState: typeof window.main.webSocketConnection.readyState.subscribe;
  getReadyState: typeof window.main.webSocketConnection.readyState.getCurrent;
}
export function createWebSocketClient(): WebSocketClient {
  return {
    event: window.main.webSocketConnection.event,
    create: window.main.webSocketConnection.create,
    close: window.main.webSocketConnection.close,
    send: window.main.webSocketConnection.event.send,
    onReadyState: window.main.webSocketConnection.readyState.subscribe,
    getReadyState: window.main.webSocketConnection.readyState.getCurrent,
  };
}
