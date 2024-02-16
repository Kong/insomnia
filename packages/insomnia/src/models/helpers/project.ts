import { database } from '../../common/database';
import { initializeLocalBackendProjectAndMarkForSync, pushSnapshotOnInitialize } from '../../sync/vcs/initialize-backend-project';
import { VCS } from '../../sync/vcs/vcs';
import { invariant } from '../../utils/invariant';
import { isDefaultOrganizationProject, Project, update as updateProject } from '../project';
import { Workspace } from '../workspace';
import { getOrCreateByParentId as getOrCreateWorkspaceMeta } from '../workspace-meta';
export const sortProjects = (projects: Project[]) => [
  ...projects.filter(p => isDefaultOrganizationProject(p))
    .sort((a, b) => a.name.localeCompare(b.name)),
  ...projects.filter(p => !isDefaultOrganizationProject(p))
    .sort((a, b) => a.name.localeCompare(b.name)),
];

export async function updateLocalProjectToRemote({
  project,
  vcs,
  sessionId,
  organizationId,
}: {
  project: Project;
  vcs: VCS;
  sessionId: string;
  organizationId: string;
}) {
  const newCloudProject = await window.main.insomniaFetch<{
    id: string;
    name: string;
  } | {
    error: string;
    message?: string;
  }>({
    path: `/v1/organizations/${organizationId}/team-projects`,
    method: 'POST',
    data: {
      name: project.name,
    },
    sessionId,
  });

  if (!newCloudProject || 'error' in newCloudProject) {
    let error = 'An unexpected error occurred while creating the project. Please try again.';
    if (newCloudProject.error === 'FORBIDDEN' || newCloudProject.error === 'NEEDS_TO_UPGRADE') {
      error = newCloudProject.error;
    }

    return {
      error,
    };
  }

  const updatedProject = await updateProject(project, { name: newCloudProject.name, remoteId: newCloudProject.id });

  // For each workspace in the local project
  const projectWorkspaces = (await database.find<Workspace>('Workspace', {
    parentId: updatedProject._id,
  }));

  for (const workspace of projectWorkspaces) {
    const workspaceMeta = await getOrCreateWorkspaceMeta(workspace._id);

    // Initialize Sync on the workspace if it's not using Git sync
    try {
      if (!workspaceMeta.gitRepositoryId) {
        invariant(vcs, 'VCS must be initialized');

        await initializeLocalBackendProjectAndMarkForSync({ vcs, workspace });
        await pushSnapshotOnInitialize({ vcs, workspace, project: updatedProject });
      }
    } catch (e) {
      console.warn('Failed to initialize sync on workspace. This will be retried when the workspace is opened on the app.', e);
      // TODO: here we should show the try again dialog
    }
  }

  return {
    error: null,
  };
};
