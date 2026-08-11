import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ChangeBufferEvent } from 'insomnia-data';
import React, { type PropsWithChildren, useEffect, useState } from 'react';

import { updateAppDataOnDbChanges } from '~/common/app-data';

const createAppDataQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: Infinity,
        retry: false,
        networkMode: 'always',
      },
    },
  });

export const AppDataCacheProvider = ({ children }: PropsWithChildren) => {
  const [queryClient] = useState(createAppDataQueryClient);

  useEffect(() => {
    return window.main.on('db.changes', (_, changes: ChangeBufferEvent[]) => {
      updateAppDataOnDbChanges(queryClient, changes);
    });
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
