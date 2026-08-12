import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { createContext, type PropsWithChildren, useContext, useState } from 'react';

// Cache client dedicated to server-backed (network) queries. Unlike the local
// database cache (AppDataCacheProvider), freshness here is pull-based: queries
// refetch when their key changes (e.g. switching organization) rather than
// being pushed updates from `db.changes`. Network-appropriate defaults live
// here so future server queries inherit them.
const createServerDataQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        staleTime: Infinity,
      },
    },
  });

const ServerDataQueryClientContext = createContext<QueryClient | null>(null);

export const ServerDataCacheProvider = ({ children }: PropsWithChildren) => {
  const [queryClient] = useState(createServerDataQueryClient);

  return (
    <ServerDataQueryClientContext.Provider value={queryClient}>
      {/*
        Server-data queries bind to this client explicitly via useServerQuery (which resolves
        useServerDataQueryClient internally), so this provider's context is intentionally shadowed
        by AppDataCacheProvider inside the org subtree and never used for resolution. We keep it
        purely for the client mount()/unmount() lifecycle it runs — Devtools registration, plus
        focus/reconnect refetch and paused-mutation resume for any future finite-staleTime query —
        which is the documented alternative to calling the undocumented client.mount() ourselves.
      */}
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ServerDataQueryClientContext.Provider>
  );
};

// Returns the server-data query client so callers can bind a query to it
// explicitly (`useQuery(options, client)`), rather than relying on the nearest
// QueryClientProvider — which, inside the organization subtree, is the local
// database cache client.
export const useServerDataQueryClient = () => {
  const queryClient = useContext(ServerDataQueryClientContext);
  if (!queryClient) {
    throw new Error('useServerDataQueryClient must be used within a ServerDataCacheProvider');
  }
  return queryClient;
};
