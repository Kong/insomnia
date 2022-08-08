import React, { createContext, FC, ReactNode, useContext } from 'react';

import { NeDBClient } from './create-nedb-client';

const NeDBClientContext = createContext<NeDBClient | undefined>(undefined);
interface Props {
  client: NeDBClient;
  children: ReactNode;
}
/**
 * Currently, the database is mapped with redux. This makes the unit testing quite hard to set up.
 * Alternatively, this context is created to provide separation between the database and the UI through Context, which also allows mocking the database without
 * setting up the database. This may be a temporary solution until we redesign how Insomnia should ship the embedded database with different db client othern than NeDB.
 */
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
