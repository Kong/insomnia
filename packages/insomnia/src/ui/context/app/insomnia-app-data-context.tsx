import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ChangeBufferEvent } from 'insomnia-data';
import React, { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';

import { updateAppDataOnDbChanges } from '~/common/app-data';

const createAppDataQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: Infinity,
        retry: false,
        // Local database queries should always be fetched regardless of network connectivity.
        networkMode: 'always',
      },
    },
  });

const DBQueryClientContext = createContext<QueryClient | null>(null);

export const AppDataCacheProvider = ({ children }: PropsWithChildren) => {
  const [queryClient] = useState(createAppDataQueryClient);

  useEffect(() => {
    return window.main.on('db.changes', (_, changes: ChangeBufferEvent[]) => {
      updateAppDataOnDbChanges(queryClient, changes);
    });
  }, [queryClient]);

  return (
    <DBQueryClientContext.Provider value={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </DBQueryClientContext.Provider>
  );
};

// Returns the local db query client
export const useDBQueryClient = () => {
  const queryClient = useContext(DBQueryClientContext);
  if (!queryClient) {
    throw new Error('useDBQueryClient must be used within an AppDataCacheProvider');
  }
  return queryClient;
};
