import {
  createTeamProject,
  getUserEntitlements,
  isApiError,
  KONNECT_CONTROL_PLANES_FEATURE,
  KONNECT_CONTROL_PLANES_FEATURE_KEY,
  type Organization,
} from 'insomnia-api';
import type { Project } from 'insomnia-data';
import { models } from 'insomnia-data';
import { services } from 'insomnia-data';
import { useCallback } from 'react';

import { invariant } from '~/common/utils/invariant';
import { useRootLoaderData } from '~/root';
import { useServerDataQueryClient } from '~/ui/context/app/server-data-context';
import { useServerQuery } from '~/ui/hooks/use-query';
import { syncVCSLikeForWorkspace } from '~/ui/sync-utils';

// TODO: move vcs into services so we can remove this file.
import {
  initializeLocalBackendProjectAndMarkForSync,
  pushSnapshotOnInitialize,
  type SyncVCSLike,
} from '../sync/vcs/initialize-backend-project';
import {
  migrateProjectsIntoOrganization,
  shouldMigrateProjectUnderOrganization,
} from '../sync/vcs/migrate-projects-into-organization';

interface KonnectSyncEnabledCache {
  enabled: boolean;
  checkedAt: number;
}

const KONNECT_SYNC_ENABLED_TTL_MS = 6 * 60 * 60 * 1000;

// Reset on every renderer start, so a cold start always re-checks the entitlement.
let hasCheckedThisSession = false;

const konnectSyncEnabledCacheKey = (accountId: string) => `${accountId}:konnectSyncEnabled`;

function readKonnectSyncEnabledCache(accountId: string): KonnectSyncEnabledCache | null {
  try {
    const raw = localStorage.getItem(konnectSyncEnabledCacheKey(accountId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as KonnectSyncEnabledCache;
    return typeof parsed?.enabled === 'boolean' ? parsed : null;
  } catch {
    return null;
  }
}

export function getKonnectSyncEnabled(accountId: string): boolean {
  return readKonnectSyncEnabledCache(accountId)?.enabled ?? false;
}

/**
 * Konnect access is account-scoped, so it is a single entitlements lookup rather than a per-
 * organization feature flag. The result is cached because `getKonnectSyncEnabled` is a synchronous
 * reader; the TTL only dedupes repeat calls, and a cold renderer always re-checks so a revoked
 * entitlement takes effect on the next app start.
 */
export async function syncKonnectSyncEnabled(
  sessionId: string,
  accountId: string,
  { force = false }: { force?: boolean } = {},
) {
  if (!sessionId || !accountId) {
    return;
  }

  const cached = readKonnectSyncEnabledCache(accountId);
  if (!force && hasCheckedThisSession && cached && Date.now() - cached.checkedAt < KONNECT_SYNC_ENABLED_TTL_MS) {
    return;
  }

  let enabled = false;
  try {
    const { entitlements } = await getUserEntitlements({
      sessionId,
      feature: KONNECT_CONTROL_PLANES_FEATURE,
    });
    enabled = (entitlements ?? []).some(
      entitlement => entitlement.featureKey === KONNECT_CONTROL_PLANES_FEATURE_KEY && entitlement.hasAccess,
    );
  } catch {
    // A failed lookup is indistinguishable from "no entitlement", so never downgrade a known-true value.
    if (cached?.enabled) {
      return;
    }
  }

  hasCheckedThisSession = true;
  localStorage.setItem(konnectSyncEnabledCacheKey(accountId), JSON.stringify({ enabled, checkedAt: Date.now() }));
}

/**
 * The Konnect organization is local-only, so it is surfaced when the account holds the Konnect
 * control-planes entitlement, or when this account already has Konnect data from a previous version
 * (in which case sync is disabled but the data stays reachable). Migration runs before hydration in
 * `entry.client.tsx`, so any Konnect data this account owns is already parented to the Konnect
 * organization by now.
 */
export async function getKonnectOrganization(sessionId: string, accountId: string): Promise<Organization | null> {
  const konnectOrganizationId = models.organization.getKonnectOrganizationId(accountId);
  // Refresh before reading rather than assuming another caller already did it. TTL-guarded, so this
  // is a no-op on all but the first load of a session.
  await syncKonnectSyncEnabled(sessionId, accountId);

  if (!getKonnectSyncEnabled(accountId)) {
    const existingKonnectProjectCount = await services.project.count({
      konnectControlPlaneId: { $exists: true, $ne: null },
      parentId: konnectOrganizationId,
    });
    if (existingKonnectProjectCount === 0) {
      return null;
    }
  }

  return models.organization.buildKonnectOrganization(accountId);
}

const konnectOrganizationKey = (accountId: string) => ['konnect-organization', accountId] as const;

/** The account's local-only Konnect organization, or null when it should not be shown. */
export function useKonnectOrganization(): Organization | null {
  const { userSession } = useRootLoaderData()!;
  const { id: sessionId, accountId } = userSession;

  const { data } = useServerQuery({
    queryKey: konnectOrganizationKey(accountId),
    queryFn: () => getKonnectOrganization(sessionId, accountId),
    enabled: !!sessionId && !!accountId,
  });

  return data ?? null;
}

/** Forces a re-check of Konnect organization visibility, e.g. after a migration or disconnect. */
export function useInvalidateKonnectOrganization() {
  const queryClient = useServerDataQueryClient();
  const { userSession } = useRootLoaderData()!;
  const accountId = userSession.accountId;

  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: konnectOrganizationKey(accountId) }),
    [queryClient, accountId],
  );
}

export async function updateLocalProjectToRemote({
  project,
  getVcsForWorkspace,
  sessionId,
  organizationId,
}: {
  project: Project;
  getVcsForWorkspace: (workspaceId: string) => SyncVCSLike;
  sessionId: string;
  organizationId: string;
}) {
  try {
    const newCloudProject = await createTeamProject({
      sessionId,
      organizationId,
      name: project.name,
    });
    const updatedProject = await services.project.update(project, {
      name: newCloudProject.name,
      remoteId: newCloudProject.id,
    });

    // For each workspace in the local project
    const projectWorkspaces = await services.workspace.listByParentId(updatedProject._id);

    for (const workspace of projectWorkspaces) {
      const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(workspace._id);

      // Initialize Sync on the workspace if it's not using Git sync
      try {
        if (!workspaceMeta.gitRepositoryId) {
          const vcs = getVcsForWorkspace(workspace._id);
          invariant(vcs, 'VCS must be initialized');

          await initializeLocalBackendProjectAndMarkForSync({ vcs, workspace });
          await pushSnapshotOnInitialize({ vcs, workspace, project: updatedProject });
        }
      } catch (e) {
        console.warn(
          'Failed to initialize sync on workspace. This will be retried when the workspace is opened on the app.',
          e,
        );
        // TODO: here we should show the try again dialog
      }
    }
  } catch (error: unknown) {
    if (isApiError(error)) {
      let errorMessage = 'An unexpected error occurred while connecting the project. Please try again.';
      if (error.name === 'FORBIDDEN' || error.name === 'NEEDS_TO_UPGRADE') {
        errorMessage = error.message;
      }
      return {
        error: errorMessage,
      };
    }
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    error: null,
  };
}

/**
 * Picks the space that orphaned legacy local projects (no parentId / no remoteId) should be
 * re-parented into: the user's solo space — an owned space with no other members. If none
 * qualifies (every owned space has collaborators), falls back to the first cached space so the
 * migration still runs.
 */
export function findMigrationTargetSpaceId(organizations: Organization[]): string {
  const soloSpace = organizations.find(o => o.is_owner && o.total_members === 1);
  return soloSpace?.id ?? organizations[0].id;
}

export async function migrateProjectsUnderOrganization(personalOrganizationId: string, sessionId: string) {
  if (await shouldMigrateProjectUnderOrganization()) {
    await migrateProjectsIntoOrganization({
      personalOrganizationId,
    });

    const preferredProjectType = localStorage.getItem('prefers-project-type');
    if (preferredProjectType === 'remote') {
      const localProjects = await services.project.list({
        parentId: personalOrganizationId,
        remoteId: null,
      });

      // If any of those fail projects will still be under the organization as local projects
      for (const project of localProjects) {
        updateLocalProjectToRemote({
          project,
          organizationId: personalOrganizationId,
          sessionId,
          getVcsForWorkspace: syncVCSLikeForWorkspace,
        });
      }
    }
  }
}
