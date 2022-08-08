import React, { createContext, FC, ReactNode, useContext } from 'react';

import { WebSocketClient } from './create-websocket-client';

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
