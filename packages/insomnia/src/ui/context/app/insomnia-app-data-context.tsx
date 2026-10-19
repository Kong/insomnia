import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ChangeBufferEvent } from 'insomnia-data';
import React, { createContext, type PropsWithChildren, useContext } from 'react';

import { updateAppDataOnDbChanges } from '~/common/app-data';

// Module-level singleton so non-React code (route loaders, getInitialEntry) can read and prefetch
// the same cache the hooks use, e.g. `dbQueryClient.ensureQueryData(...)`.
export const dbQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: Infinity,
      retry: false,
      // Local database queries should always be fetched regardless of network connectivity.
      networkMode: 'always',
      refetchOnWindowFocus: false,
    },
  },
});

// Subscribe at module level rather than in the provider so the cache stays in sync with the
// database even before the provider mounts (e.g. while route loaders run ahead of hydration).
if (typeof window !== 'undefined' && window.main?.on) {
  const unsubscribe = window.main.on('db.changes', (_, changes: ChangeBufferEvent[]) => {
    updateAppDataOnDbChanges(dbQueryClient, changes);
  });
  import.meta.hot?.dispose(unsubscribe);
}

const DBQueryClientContext = createContext<QueryClient | null>(null);

export const AppDataCacheProvider = ({ children }: PropsWithChildren) => {
  return (
    <DBQueryClientContext.Provider value={dbQueryClient}>
      <QueryClientProvider client={dbQueryClient}>{children}</QueryClientProvider>
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
