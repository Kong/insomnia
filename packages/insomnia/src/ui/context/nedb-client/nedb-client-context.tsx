import React, { createContext, FC, ReactNode, useContext } from 'react';

import { NeDBClient } from './create-nedb-client';

export const NeDBClientContext = createContext<NeDBClient | undefined>(undefined);
interface Props {
  client: NeDBClient;
  children: ReactNode;
}
export const NeDBClientProvider: FC<Props> = ({ client, children }) => {
  return (
    <NeDBClientContext.Provider value={client}>
      {children}
    </NeDBClientContext.Provider>
  );
};
export function useNeDBClient(): NeDBClient {
  const context = useContext(NeDBClientContext);
  if (!context) {
    throw new Error('Use useWebSocketClient hook with <WebSocketClientProvider /> ');
  }

  return context;
}
