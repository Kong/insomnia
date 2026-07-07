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

export const InsomniaTanstackQueryClientContext = ({
  children,
  organizationId,
}: PropsWithChildren<{ organizationId: string }>) => {
  useEffect(() => {
    return subscribeQueryClientToDbChanges(dbQueryClient);
  }, []);

  useEffect(() => {
    // When the organizationId changes, we need to invalidate the cache for that organization so that it will be refetched.
    dbQueryClient.invalidateQueries({ queryKey: ['organization-data', organizationId] });
  }, [organizationId]);

  return <QueryClientProvider client={dbQueryClient}>{children}</QueryClientProvider>;
};
