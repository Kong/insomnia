import { QueryClient } from '@tanstack/react-query';

// Single shared QueryClient instance for all database queries.
// Set default options for local db queries to never refetch or retry, and consider data always fresh (staleTime: Infinity).
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

if (typeof window !== 'undefined') {
  // @ts-expect-error - Expose the dbQueryClient on the window object for debugging purposes. This is not intended for production use.
  window.__TANSTACK_QUERY_CLIENT__ = dbQueryClient;
}
