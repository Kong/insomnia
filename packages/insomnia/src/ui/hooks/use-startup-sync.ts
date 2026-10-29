import { type QueryStatus, queryOptions } from '@tanstack/react-query';
import type { Organization } from 'insomnia-api';
import { services } from 'insomnia-data';
import { useCallback } from 'react';

import { syncProjects } from '~/common/project';
import { invariant } from '~/common/utils/invariant';
import { useServerMutation, useServerQuery } from '~/ui/hooks/use-query';
import { findMigrationTargetSpaceId, migrateProjectsUnderOrganization } from '~/ui/organization-utils';

// Migrates legacy projects into the account's organizations and syncs the team projects of the
// given organization. Results reach the UI through `db.changes` only: the project / workspace
// views derive their project data from the organization data query, and the empty project view
// moves on by itself once projects appear, so nothing needs to revalidate or redirect here.
async function runStartupSync(organizationId: string) {
  const { id: sessionId, accountId } = await services.userSession.get();
  // Logged out (the scratchpad): there is nothing to migrate or sync.
  if (!sessionId) {
    return;
  }
  const organizations = JSON.parse(localStorage.getItem(`${accountId}:spaces`) || '[]') as Organization[];
  invariant(organizations.length, 'Failed to fetch organizations.');

  // Sequential: the sync matches team projects by `remoteId`, which the migration rewrites for legacy
  // remote projects, so syncing first would create duplicates of them. The migration is a no-op (two
  // local counts) once nothing is left to migrate, so running it again per organization is cheap.
  await migrateProjectsUnderOrganization(findMigrationTargetSpaceId(organizations), sessionId);
  await syncProjects(organizationId);
}

/**
 * The startup sync of one organization as a query: one run per organization and session, shared by
 * every component that reads it. Its data is only a "done" marker, so it never goes stale and is
 * kept for the session; signing out clears the cache, so the next session syncs again. A failed run
 * is not retried by itself, not even when a component mounts again: the sync indicator offers the
 * retry.
 */
export const startupSyncQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ['startup-sync', organizationId],
    queryFn: async () => {
      try {
        await runStartupSync(organizationId);
      } catch (error) {
        console.log('Failed to run async task', error);
        throw error;
      }
      return null;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    retryOnMount: false,
  });

/**
 * Runs the startup sync in the background the first time an organization is entered in this
 * session, whichever way the app got there (restored on launch, after signing in, switching
 * organizations). A retry always runs the full task set again.
 */
export function useStartupSync(organizationId: string) {
  const { isFetching, isError, refetch } = useServerQuery(startupSyncQuery(organizationId));
  const retry = useCallback(() => refetch(), [refetch]);

  return {
    status: isFetching ? 'pending' : isError ? 'error' : 'idle',
    retry,
  } as const;
}

/**
 * The status of the organization's startup sync, `pending` until its first run settles. Reading it
 * also starts the run when none has started yet, so a child route can rely on it before the
 * organization layout has rendered.
 */
export function useStartupSyncStatus(organizationId: string): QueryStatus {
  return useServerQuery(startupSyncQuery(organizationId)).status;
}

/** Syncs an organization's team projects, e.g. when another member changes them. */
export function useSyncProjects() {
  return useServerMutation({
    mutationFn: syncProjects,
    onError: error => console.log('[sync] Failed to sync projects', error),
  });
}
