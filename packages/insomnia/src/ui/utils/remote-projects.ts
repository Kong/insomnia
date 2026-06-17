import { database, models, services, type Workspace } from 'insomnia-data';

import { type InsomniaFile } from '~/common/project';

export const getAllRemoteBackendProjectsOfOrg = async ({ organizationId }: { organizationId: string }) => {
  return window.main.sync.remoteBackendProjectsOfTeam({ teamId: organizationId });
};

export async function getAllRemoteFiles({ projectId, organizationId }: { projectId: string; organizationId: string }) {
  try {
    const project = await services.project.get(projectId);

    const remoteId = project?.remoteId;
    if (!remoteId) {
      return [];
    }

    console.log(
      '[getAllRemoteFiles] start fetching remote backend workspaces for project',
      projectId,
      `remoteId: ${remoteId}`,
    );

    const [allPulledBackendProjectsForRemoteId, allFetchedRemoteBackendProjectsForRemoteId] = await Promise.all([
      window.main.sync.localBackendProjects().then(projects => projects.filter(p => p.id === remoteId)),
      // Remote backend projects are fetched from the backend since they are not stored locally
      window.main.sync.remoteBackendProjects({ teamId: organizationId, teamProjectId: remoteId }),
    ]);
    console.log(
      `[getAllRemoteFiles] found allPulledBackendProjectsForRemoteId: ${allPulledBackendProjectsForRemoteId.length} and allFetchedRemoteBackendProjectsForRemoteId: ${allFetchedRemoteBackendProjectsForRemoteId.length} for remoteId: ${remoteId}`,
    );
    // Get all workspaces that are connected to backend projects and under the current project
    const workspacesWithBackendProjects = await database.find<Workspace>(models.workspace.type, {
      _id: {
        $in: [...allPulledBackendProjectsForRemoteId, ...allFetchedRemoteBackendProjectsForRemoteId].map(
          p => p.rootDocumentId,
        ),
      },
      parentId: project._id,
    });
    console.log(`[getAllRemoteFiles] found workspacesWithBackendProjects: ${workspacesWithBackendProjects.length}`);
    // Get the list of remote backend projects that we need to pull
    const backendProjectsToPull = allFetchedRemoteBackendProjectsForRemoteId.filter(
      p => !workspacesWithBackendProjects.find(w => w._id === p.rootDocumentId),
    );
    console.log(`[getAllRemoteFiles] get ${backendProjectsToPull.length} unsynced files`);
    return backendProjectsToPull.map(backendProject => {
      const file: InsomniaFile = {
        id: backendProject.rootDocumentId,
        name: backendProject.name,
        scope: 'unsynced',
        label: 'Unsynced',
        remoteId: backendProject.id,
        created: 0,
        lastModifiedTimestamp: 0,
      };

      return file;
    });
  } catch (e) {
    console.warn('Failed to load backend projects', e);
  }

  return [];
}
