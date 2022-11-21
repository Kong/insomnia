import { isNotNullOrUndefined } from '@insomnia/common/misc';
import * as models from '@insomnia/models';
import { BackendProject } from '@insomnia/sync/types';
import { getVCS } from '@insomnia/sync/vcs/vcs';
import { invariant } from '@remix-run/router';
import { LoaderFunction } from 'react-router-dom';

export interface RemoteCollectionsLoaderData {
  remoteBackendProjects: BackendProject[];
}

export const loader: LoaderFunction = async ({ params }): Promise<RemoteCollectionsLoaderData> => {
  const { projectId } = params;
  invariant(typeof projectId === 'string', 'Project Id is required');

  try {
    const project = await models.project.getById(projectId);
    invariant(project, 'Project not found');
    const vcs = getVCS();
    invariant(vcs, 'VCS is not defined');

    const remoteId = project.remoteId;
    invariant(remoteId, 'Project is not a remote project');

    const allVCSBackendProjects = await vcs.localBackendProjects();
    // Filter out backend projects that are not connected to a workspace because the workspace was deleted
    const getWorkspacesByLocalProjects = allVCSBackendProjects.map(async backendProject => {
      const workspace = await models.workspace.getById(backendProject.rootDocumentId);

      if (!workspace) {
        return null;
      }

      return backendProject;
    });

    // Map the backend projects to ones with workspaces in parallel
    const localBackendProjects = (await Promise.all(getWorkspacesByLocalProjects)).filter(isNotNullOrUndefined);

    const remoteBackendProjects = (await vcs.remoteBackendProjects(remoteId)).filter(({ id, rootDocumentId }) => {
      const localBackendProjectExists = localBackendProjects.find(p => p.id === id);
      const workspaceExists = Boolean(models.workspace.getById(rootDocumentId));
      // Mark as missing if:
      //   - the backend project doesn't yet exists locally
      //   - the backend project exists locally but somehow the workspace doesn't anymore
      return !(workspaceExists && localBackendProjectExists);
    });

    return {
      remoteBackendProjects,
    };
  } catch (e) {
    console.warn('Failed to load backend projects', e);
  }

  return {
    remoteBackendProjects: [],
  };
};
