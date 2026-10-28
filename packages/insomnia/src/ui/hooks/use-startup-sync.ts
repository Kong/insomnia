import { useMutationState } from '@tanstack/react-query';
import type { Organization } from 'insomnia-api';
import { services } from 'insomnia-data';
import { useCallback, useEffect } from 'react';

import { syncProjects } from '~/common/project';
import { invariant } from '~/common/utils/invariant';
import { useServerDataQueryClient } from '~/ui/context/app/server-data-context';
import { useServerMutation } from '~/ui/hooks/use-query';
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

const startupSyncMutationKey = (organizationId: string) => ['startup-sync', organizationId];

/**
 * Runs the startup sync in the background the first time an organization is entered in this
 * session, whichever way the app got there (restored on launch, after signing in, switching
 * organizations). A retry always runs the full task set again.
 */
export function useStartupSync(organizationId: string) {
  const queryClient = useServerDataQueryClient();
  const mutationKey = startupSyncMutationKey(organizationId);
  const { mutate } = useServerMutation({
    mutationKey,
    mutationFn: runStartupSync,
    onError: error => console.log('Failed to run async task', error),
    // Keep every run for the session: it marks the organization as synced, and a failed one keeps
    // the indicator offering a retry. Signing out clears the cache, so the next session syncs again.
    gcTime: Infinity,
  });
  // Read the status from the mutation cache rather than from `useMutation`: under StrictMode the
  // simulated unmount detaches its observer from the in-flight run, and as the effect below skips
  // an organization that already has a run, nothing would re-attach it.
  const statuses = useMutationState(
    { filters: { mutationKey, exact: true }, select: mutation => mutation.state.status },
    queryClient,
  );
  const status = statuses.at(-1) ?? 'idle';

  useEffect(() => {
    // Once per organization: a run in the cache, in flight or settled, means it was synced already.
    // This also absorbs the StrictMode double effect.
    const hasRun = queryClient
      .getMutationCache()
      .find({ mutationKey: startupSyncMutationKey(organizationId), exact: true });
    if (!hasRun) {
      mutate(organizationId);
    }
  }, [mutate, organizationId, queryClient]);

  const retry = useCallback(() => mutate(organizationId), [mutate, organizationId]);

  return {
    status: status === 'success' ? 'idle' : status,
    retry,
  } as const;
}

/** Syncs an organization's team projects, e.g. when another member changes them. */
export function useSyncProjects() {
  return useServerMutation({
    mutationFn: syncProjects,
    onError: error => console.log('[sync] Failed to sync projects', error),
  });
}
