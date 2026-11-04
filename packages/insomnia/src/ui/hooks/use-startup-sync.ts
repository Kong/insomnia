import { queryOptions } from '@tanstack/react-query';
import { services } from 'insomnia-data';
import { useCallback } from 'react';

import { syncProjects } from '~/common/project';
import { useServerMutation, useServerQuery } from '~/ui/hooks/use-query';

const isFirstAccountLanding = (accountId: string) => {
  try {
    const firstAccountLandingKey = `firstAccountLandingHandled:${accountId}`;
    const legacyFirstPersonalOrgLandingKey = `firstPersonalOrgLandingHandled:${accountId}`;

    return (
      !window.localStorage.getItem(firstAccountLandingKey) &&
      !window.localStorage.getItem(legacyFirstPersonalOrgLandingKey)
    );
  } catch (error) {
    console.warn('[project] Failed to evaluate first account landing state', error);
    return false;
  }
};

// Creates the "Drafts" project with a first collection when an account lands for the first time in
// an organization that still has no projects once its team projects are synced. Checks the
// database rather than the cache, which may not have heard about the synced projects yet. A failure
// only leaves the organization empty.
async function createInitialProjectIfNeeded(organizationId: string, accountId: string) {
  if (!isFirstAccountLanding(accountId)) {
    return;
  }
  try {
    if ((await services.project.count({ parentId: organizationId })) > 0) {
      return;
    }
    const project = await services.project.create({ name: 'Drafts', parentId: organizationId });
    await services.workspace.create({ name: 'My first collection', scope: 'collection', parentId: project._id });
    return project._id;
  } catch (error) {
    console.warn('[project] Failed to auto-create initial local project', error);
    return;
  }
}

export interface StartupSyncResult {
  /** The "Drafts" project created for the account's first landing, if any. */
  initialProjectId?: string;
}

// Syncs the team projects of the given organization, then creates the first-landing project if it
// is still empty. The account-wide project migration has already run in the organization layout's
// middleware (`prepareAccount`), which every route inside an organization passes through first.
// Results reach the UI through `db.changes` only: the project / workspace views derive their
// project data from the organization data query, and the empty project view moves on by itself
// once projects appear, so nothing needs to revalidate or redirect here.
async function runStartupSync(organizationId: string): Promise<StartupSyncResult> {
  const { id: sessionId, accountId } = await services.userSession.get();
  // Logged out (the scratchpad): there is nothing to sync.
  if (!sessionId) {
    return {};
  }
  await syncProjects(organizationId);
  return { initialProjectId: await createInitialProjectIfNeeded(organizationId, accountId) };
}

/**
 * The startup sync of one organization as a query: one run per organization and session, shared by
 * every component that reads it — the organization layout, and the empty project view, which may
 * render first. Its result never goes stale and is kept for the session; signing out clears the
 * cache, so the next session syncs again. A failed run is not retried by itself, not even when a
 * component mounts again: the sync indicator offers the retry.
 */
export const startupSyncQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ['startup-sync', organizationId],
    queryFn: async () => {
      try {
        return await runStartupSync(organizationId);
      } catch (error) {
        console.log('Failed to run async task', error);
        throw error;
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    retryOnMount: false,
  });

/**
 * Runs the startup sync in the background the first time an organization is entered in this
 * session, whichever way the app got there (restored on launch, after signing in, switching
 * organizations). A retry runs the sync again for the current organization.
 */
export function useStartupSync(organizationId: string) {
  const { isFetching, isError, refetch } = useServerQuery(startupSyncQuery(organizationId));
  const retry = useCallback(() => refetch(), [refetch]);

  return {
    status: isFetching ? 'pending' : isError ? 'error' : 'idle',
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
