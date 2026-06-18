import { createTeamProject, fetchTeamProjects, getCurrentPlan, getUserProfile, isApiError } from 'insomnia-api';
import type { Project, Workspace } from 'insomnia-data';
import { database, models, services } from 'insomnia-data';

import { projectLock } from '~/common/project';
import { invariant } from '~/common/utils/invariant';

import {
  initializeLocalBackendProjectAndMarkForSync,
  pushSnapshotOnInitialize,
  type SyncVCSLike,
} from '../sync/vcs/initialize-backend-project';
import {
  migrateProjectsIntoOrganization,
  shouldMigrateProjectUnderOrganization,
} from '../sync/vcs/migrate-projects-into-organization';
export { DEFAULT_STORAGE_RULES, fetchAndCacheOrganizationStorageRule } from '~/common/organization-storage-rules';

export async function syncCurrentPlan(sessionId: string, accountId: string) {
  const [currentPlanResult] = await Promise.allSettled([getCurrentPlan({ sessionId })]);
  if (currentPlanResult.status === 'fulfilled' && currentPlanResult.value) {
    localStorage.setItem(`${accountId}:currentPlan`, JSON.stringify(currentPlanResult.value));
  } else {
    console.log('[current-plan] Failed to load current-plan', currentPlanResult.status);
  }
}

export async function syncOrganizations(sessionId: string, accountId: string) {
  try {
    const [organizations, user, currentPlan] = await Promise.all([
      services.organization.list(),
      getUserProfile({ sessionId }),
      getCurrentPlan({ sessionId }),
    ]);

    invariant(organizations, 'Failed to load organizations');
    invariant(user && user.id, 'Failed to load user');
    invariant(currentPlan && currentPlan.planId, 'Failed to load current plan');

    invariant(accountId, 'Account ID is not defined');

    localStorage.setItem(`${accountId}:organizations`, JSON.stringify(organizations));
    localStorage.setItem(`${accountId}:user`, JSON.stringify(user));
    localStorage.setItem(`${accountId}:currentPlan`, JSON.stringify(currentPlan));
  } catch (error) {
    console.log('[organization] Failed to load Organizations', error);
  }
}

export async function updateLocalProjectToRemote({
  project,
  vcs,
  sessionId,
  organizationId,
}: {
  project: Project;
  vcs: SyncVCSLike;
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
    const projectWorkspaces = await database.find<Workspace>('Workspace', {
      parentId: updatedProject._id,
    });

    for (const workspace of projectWorkspaces) {
      const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(workspace._id);

      // Initialize Sync on the workspace if it's not using Git sync
      try {
        if (!workspaceMeta.gitRepositoryId) {
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

export async function migrateProjectsUnderOrganization(personalOrganizationId: string, sessionId: string) {
  if (await shouldMigrateProjectUnderOrganization()) {
    await migrateProjectsIntoOrganization({
      personalOrganizationId,
    });

    const preferredProjectType = localStorage.getItem('prefers-project-type');
    if (preferredProjectType === 'remote') {
      const localProjects = await database.find<Project>('Project', {
        parentId: personalOrganizationId,
        remoteId: null,
      });

      // If any of those fail projects will still be under the organization as local projects
      for (const project of localProjects) {
        updateLocalProjectToRemote({
          project,
          organizationId: personalOrganizationId,
          sessionId,
          vcs: window.main.sync,
        });
      }
    }
  }
}

interface TeamProject {
  id: string;
  name: string;
}

async function getAllTeamProjects(organizationId: string) {
  const { id: sessionId } = await services.userSession.get();
  if (!sessionId) {
    return [];
  }

  console.log('[project] Fetching', organizationId);
  const response = await fetchTeamProjects({ sessionId, organizationId });

  return response.data;
}

async function syncTeamProjects({
  organizationId,
  teamProjects,
}: {
  teamProjects: TeamProject[];
  organizationId: string;
}) {
  // assumption: api teamProjects is the source of truth for migrated projects
  // once migrated orgs become the source of truth for projects
  // its important that migration be completed before this code is run
  const existingRemoteProjects = await database.find<Project>(models.project.type, {
    remoteId: { $in: teamProjects.map(p => p.id) },
  });

  const existingRemoteProjectsRemoteIds = existingRemoteProjects.map(p => p.remoteId);
  const remoteProjectsThatNeedToBeCreated = teamProjects.filter(p => !existingRemoteProjectsRemoteIds.includes(p.id));

  // this will create a new project for any remote projects that don't exist in the current organization
  await Promise.all(
    remoteProjectsThatNeedToBeCreated.map(async prj => {
      await services.project.create({
        remoteId: prj.id,
        name: prj.name,
        parentId: organizationId,
      });
    }),
  );

  const remoteProjectsThatNeedToBeUpdated = await database.find<Project>(models.project.type, {
    // Remote ID is in the list of remote projects
    remoteId: { $in: teamProjects.map(p => p.id) },
  });

  await Promise.all(
    remoteProjectsThatNeedToBeUpdated.map(async prj => {
      const remoteProject = teamProjects.find(p => p.id === prj.remoteId);
      if (remoteProject && remoteProject.name !== prj.name) {
        await services.project.update(prj, {
          name: remoteProject.name,
        });
      }
    }),
  );

  // Turn remote projects from the current organization that are not in the list of remote projects into local projects.
  const removedRemoteProjects = await database.find<Project>(models.project.type, {
    // filter by this organization so no legacy data can be accidentally removed, because legacy had null parentId
    parentId: organizationId,
    // Remote ID is not in the list of remote projects.
    // add `$ne: null` condition because if remoteId is already null, we dont need to remove it again.
    // nedb use append-only format, all updates and deletes actually result in lines added
    remoteId: {
      $nin: teamProjects.map(p => p.id),
      $ne: null,
    },
  });

  await Promise.all(
    removedRemoteProjects.map(async prj => {
      await services.project.update(prj, {
        remoteId: null,
      });
    }),
  );
}

export const syncProjects = projectLock.wrapWithLock(async (organizationId: string) => {
  const user = await services.userSession.get();
  const teamProjects = await getAllTeamProjects(organizationId);
  // ensure we don't sync projects in the wrong place
  if (Array.isArray(teamProjects) && user.id && !models.organization.isScratchpadOrganizationId(organizationId)) {
    await syncTeamProjects({
      organizationId,
      teamProjects,
    });
  }
});
