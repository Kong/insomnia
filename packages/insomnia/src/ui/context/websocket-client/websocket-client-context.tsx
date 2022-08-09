import React, { createContext, FC, ReactNode, useContext } from 'react';

import { WebSocketClient } from './create-websocket-client';

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
