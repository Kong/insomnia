import type { CurrentPlan, Organization, User } from 'insomnia-api';
import { useCallback } from 'react';

import {
  fetchOrganizationData,
  type OrganizationData,
  readOrganizationDataFromLocalStorage,
  writeOrganizationDataToLocalStorage,
} from '~/common/organization';
import { useRootLoaderData } from '~/root';
import { useServerDataQueryClient } from '~/ui/context/app/server-data-context';
import { useServerQuery } from '~/ui/hooks/use-query';

// Account-scoped server data (organizations / user / current plan).
const accountServerDataKey = (accountId: string) => ['account-server-data', accountId] as const;

const loggedOutData: OrganizationData = { organizations: [], user: undefined, currentPlan: undefined };

// Stable selector references so TanStack doesn't re-run them every render.
const selectOrganizations = (data: OrganizationData) => data.organizations;
const selectUser = (data: OrganizationData) => data.user;
const selectCurrentPlan = (data: OrganizationData) => data.currentPlan;

/**
 * The single source of truth (for React consumers) of the current account's organizations,
 * user and current plan.
 * Freshness: the server-data client's default `staleTime` refetches on mount, so the value is
 * authoritative regardless of what localStorage held. The queryFn writes the result through to
 * localStorage — a bridge that keeps the remaining non-React readers (`getInitialEntry`, various
 * loaders, event-stream handlers) working while their migration is done in a later phase.
 *
 * Refresh is event-driven and owned by `useInvalidateAccountData` (SSE `OrganizationChanged`,
 * trial start, etc.).
 *
 * Prefer the slice hooks below (`useOrganizations` / `useCurrentUser` / `useCurrentPlan`) at call
 * sites; each subscribes to only its slice.
 */
function useAccountServerData<TData>(select: (data: OrganizationData) => TData): TData | undefined {
  const { userSession } = useRootLoaderData()!;
  const sessionId = userSession.id;
  const accountId = userSession.accountId;
  const isLoggedIn = !!sessionId;

  const { data } = useServerQuery({
    queryKey: accountServerDataKey(accountId),
    queryFn: async () => {
      const result = await fetchOrganizationData(sessionId);
      writeOrganizationDataToLocalStorage(accountId, result);
      return result;
    },
    // Seed from localStorage for an instant first paint (matching the old loader, which read
    // localStorage synchronously). When logged out we intentionally keep `user`/`currentPlan`
    // undefined so consumers can distinguish "no user".
    initialData: () => (isLoggedIn ? readOrganizationDataFromLocalStorage(accountId) : loggedOutData),
    enabled: isLoggedIn,
    select,
  });

  return data;
}

/** The current account's organizations. Always an array. */
export function useOrganizations(): Organization[] {
  return useAccountServerData(selectOrganizations) ?? [];
}

/** The signed-in user, or undefined when logged out / not yet loaded. */
export function useCurrentUser(): User | undefined {
  return useAccountServerData(selectUser);
}

/** The account's current plan, or undefined when logged out / not yet loaded. */
export function useCurrentPlan(): CurrentPlan | undefined {
  return useAccountServerData(selectCurrentPlan);
}

export function useInvalidateAccountData() {
  const queryClient = useServerDataQueryClient();
  const { userSession } = useRootLoaderData()!;
  const accountId = userSession.accountId;

  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: accountServerDataKey(accountId) }),
    [queryClient, accountId],
  );
}
