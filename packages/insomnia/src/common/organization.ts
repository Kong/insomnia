import { queryOptions } from '@tanstack/react-query';
import { type CurrentPlan, getCurrentPlan, getUserProfile, type Organization, type User } from 'insomnia-api';
import { services } from 'insomnia-data';

import { invariant } from '~/common/utils/invariant';

export interface OrganizationData {
  organizations: Organization[];
  user?: User;
  currentPlan?: CurrentPlan;
}

// Fetches the organization triple (organizations / user / current plan) from the
// cloud API in parallel. Throws if any of the three fail their invariant.
export async function fetchOrganizationData(sessionId: string): Promise<OrganizationData> {
  const [organizations, user, currentPlan] = await Promise.all([
    services.organization.list(),
    getUserProfile({ sessionId }),
    getCurrentPlan({ sessionId }),
  ]);

  invariant(organizations, 'Failed to load organizations');
  invariant(user && user.id, 'Failed to load user');
  invariant(currentPlan && currentPlan.planId, 'Failed to load current plan');

  return { organizations, user, currentPlan };
}

// Write-through helper: persists the organization triple to localStorage so the
// non-React readers (`getInitialEntry`, various loaders, event-stream handlers, etc.)
// keep working while the migration to TanStack Query is incremental.
export function writeOrganizationDataToLocalStorage(accountId: string, data: OrganizationData) {
  invariant(accountId, 'Account ID is not defined');
  localStorage.setItem(`${accountId}:spaces`, JSON.stringify(data.organizations));
  localStorage.setItem(`${accountId}:user`, JSON.stringify(data.user));
  localStorage.setItem(`${accountId}:currentPlan`, JSON.stringify(data.currentPlan));
}

// Reads the persisted triple back from localStorage. Used to seed the query's
// `initialData` so the first paint is instant (matching the old loader, which read
// localStorage synchronously). Defaults mirror the previous loader behaviour.
export function readOrganizationDataFromLocalStorage(accountId: string): OrganizationData {
  const userRaw = localStorage.getItem(`${accountId}:user`);
  const currentPlanRaw = localStorage.getItem(`${accountId}:currentPlan`);
  return {
    organizations: JSON.parse(localStorage.getItem(`${accountId}:spaces`) || '[]') as Organization[],
    // Leave these undefined (not `{}`) when the key is absent, so consumers can rely on the
    // declared optional shape — casting `{}` to User/CurrentPlan hides missing fields from the
    // type checker and causes runtime NPEs (e.g. `currentPlan.type.includes`).
    user: userRaw ? (JSON.parse(userRaw) as User) : undefined,
    currentPlan: currentPlanRaw ? (JSON.parse(currentPlanRaw) as CurrentPlan) : undefined,
  };
}

export const accountServerDataKey = (accountId: string) => ['account-server-data', accountId] as const;

/**
 * The account's organizations / user / current plan, shared by the React hooks
 * (`useOrganizations`…) and non-React callers (`serverQueryClient.ensureQueryData(...)`), so both
 * read and refresh one cache.
 * localStorage is its persistence layer: it seeds the query when the query is first used (cache
 * first, so landing never waits for the network when a list is cached) and every fetch writes
 * through to it for the remaining non-React readers. Without a cached organization list there is
 * no seed, so the first read fetches.
 */
export const accountServerDataQuery = (accountId: string, sessionId: string) =>
  queryOptions({
    queryKey: accountServerDataKey(accountId),
    queryFn: async () => {
      const result = await fetchOrganizationData(sessionId);
      writeOrganizationDataToLocalStorage(accountId, result);
      return result;
    },
    initialData: () => {
      const cached = readOrganizationDataFromLocalStorage(accountId);
      return cached.organizations.length ? cached : undefined;
    },
  });
