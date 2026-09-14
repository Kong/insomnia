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
import { useMemo, useSyncExternalStore } from 'react';

import { invariant } from '~/common/utils/invariant';
import { useRootLoaderData } from '~/root';
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

interface KonnectAccess {
  /** The account holds the Konnect control-planes entitlement, so syncing is allowed. */
  hasEntitlement: boolean;
  /** The Konnect organization should appear in the organization list. */
  isOrganizationVisible: boolean;
}

const konnectEntitlementStorageKey = (accountId: string) => `${accountId}:konnectSyncEnabled`;

let konnectAccess: KonnectAccess = { hasEntitlement: false, isOrganizationVisible: false };
let konnectAccessResolvedFor: string | null = null;
const konnectAccessListeners = new Set<() => void>();

const subscribeToKonnectAccess = (listener: () => void) => {
  konnectAccessListeners.add(listener);
  return () => {
    konnectAccessListeners.delete(listener);
  };
};

function setKonnectAccess(next: KonnectAccess) {
  if (
    next.hasEntitlement === konnectAccess.hasEntitlement &&
    next.isOrganizationVisible === konnectAccess.isOrganizationVisible
  ) {
    return;
  }
  konnectAccess = next;
  konnectAccessListeners.forEach(listener => listener());
}

/**
 * Resolves Konnect access for the account. Awaited before hydration and again after signing in so
 * that render-time readers can stay synchronous; the two mutations that can flip it mid-session
 * (disconnecting the PAT, resolving the migration conflict) pass `force`.
 *
 * Visibility is the entitlement OR local Konnect data from a previous version, which stays
 * reachable with syncing disabled. Callers must run the startup migration first, otherwise the
 * project lookup still sees the pre-migration parents.
 */
export async function refreshKonnectAccess(
  sessionId: string,
  accountId: string,
  { force = false }: { force?: boolean } = {},
) {
  if (!force && konnectAccessResolvedFor === accountId) {
    return;
  }
  konnectAccessResolvedFor = accountId;

  if (!sessionId || !accountId) {
    setKonnectAccess({ hasEntitlement: false, isOrganizationVisible: false });
    return;
  }

  let hasEntitlement = localStorage.getItem(konnectEntitlementStorageKey(accountId)) === 'true';
  try {
    const { entitlements } = await getUserEntitlements({
      sessionId,
      feature: KONNECT_CONTROL_PLANES_FEATURE,
    });
    hasEntitlement = (entitlements ?? []).some(
      entitlement => entitlement.featureKey === KONNECT_CONTROL_PLANES_FEATURE_KEY && entitlement.hasAccess,
    );
    localStorage.setItem(konnectEntitlementStorageKey(accountId), String(hasEntitlement));
  } catch {
    // Offline: keep the last known answer rather than hiding an organization the user owns.
  }

  const localKonnectProjectCount = await services.project.count({
    konnectControlPlaneId: { $exists: true, $ne: null },
    parentId: models.organization.getKonnectOrganizationId(accountId),
  });

  setKonnectAccess({ hasEntitlement, isOrganizationVisible: hasEntitlement || localKonnectProjectCount > 0 });
}

/** Whether the account may sync from Konnect. */
export function useKonnectSyncEnabled(): boolean {
  return useSyncExternalStore(subscribeToKonnectAccess, () => konnectAccess.hasEntitlement);
}

/** The account's local-only Konnect organization, or null when it should not be shown. */
export function useKonnectOrganization(): Organization | null {
  const { userSession } = useRootLoaderData()!;
  const accountId = userSession.accountId;
  const isOrganizationVisible = useSyncExternalStore(
    subscribeToKonnectAccess,
    () => konnectAccess.isOrganizationVisible,
  );

  return useMemo(
    () => (isOrganizationVisible && accountId ? models.organization.buildKonnectOrganization(accountId) : null),
    [isOrganizationVisible, accountId],
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
