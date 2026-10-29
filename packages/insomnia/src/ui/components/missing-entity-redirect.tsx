import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router';

import { AppLoadingIndicator } from '~/ui/components/app-loading-indicator';
import { useDBQuery } from '~/ui/hooks/use-query';
import { useIsRouterIdle } from '~/ui/utils/router';

// Short waits (a local re-read takes a few dozen milliseconds) show nothing rather than flashing
// the indicator.
const LOADING_INDICATOR_DELAY_MS = 200;

export const DelayedLoadingIndicator = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setIsVisible(true), LOADING_INDICATOR_DELAY_MS);
    return () => clearTimeout(timeout);
  }, []);

  return isVisible ? <AppLoadingIndicator /> : null;
};

/**
 * Rendered by a route instead of its content while the entity it shows (a project, a workspace…) is
 * not in the cached query data — or, more generally, while the cached data says the route is the
 * wrong place to be (e.g. the empty project view of an organization that has projects).
 *
 * A miss is not trusted right away: the cache learns about writes through `db.changes`, which can
 * arrive after a writer has already navigated here (e.g. into a project it just created). So the
 * query is re-read once, showing a delayed loading indicator meanwhile — if the entity turns up, the
 * route renders its content again and this unmounts. Only a miss that survives the re-read
 * navigates to `getRedirectTo(data)`, and only once the router is idle, so an action that redirects
 * by itself (e.g. a delete) wins.
 */
export function MissingEntityRedirect<TQueryFnData, TError, TData, TQueryKey extends QueryKey>({
  queryOptions,
  getRedirectTo,
}: {
  queryOptions: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>;
  getRedirectTo: (data: TData) => string;
}) {
  const { data, error, refetch, isFetchedAfterMount, isFetching } = useDBQuery(queryOptions);
  const isRouterIdle = useIsRouterIdle();

  useEffect(() => {
    // Also cancels a fetch already in flight, which may have started before the write.
    refetch();
  }, [refetch]);

  // Without data there is nothing to decide the redirect on: hand a failed read to the route's
  // ErrorBoundary rather than showing the loading indicator forever.
  if (data === undefined && error) {
    throw error;
  }
  if (data === undefined || !isFetchedAfterMount || isFetching || !isRouterIdle) {
    return <DelayedLoadingIndicator />;
  }
  return <Navigate to={getRedirectTo(data)} replace />;
}
