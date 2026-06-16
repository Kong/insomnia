import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type PropsWithChildren, useEffect } from 'react';

import { subscribeQueryClientToDbChanges } from '~/ui/hooks/data/db-changes-sync';

// Single shared QueryClient instance for all database queries.
// This client treats as the cache of the local NeDB database and will listen to db.change events
export const dbQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
    },
  },
});

export const InsomniaTanstackQueryClientContext = ({ children }: PropsWithChildren) => {
  useEffect(() => subscribeQueryClientToDbChanges(dbQueryClient), []);
  return <QueryClientProvider client={dbQueryClient}>{children}</QueryClientProvider>;
};
