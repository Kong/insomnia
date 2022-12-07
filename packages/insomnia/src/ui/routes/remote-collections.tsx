import * as models from '@insomnia/models';
import { RemoteProject } from '@insomnia/models/project';
import { ActionFunction, LoaderFunction } from 'react-router-dom';

import { database } from '@insomnia/common/database';
import { isNotNullOrUndefined } from '@insomnia/common/misc';
import { BackendProject } from '../../sync/types';
import { pullBackendProject } from '../../sync/vcs/pull-backend-project';
import { getVCS } from '../../sync/vcs/vcs';
import { invariant } from '../../utils/invariant';

export const pullRemoteCollectionAction: ActionFunction = async ({ request }) => {
  const formData = await request.formData();

  const backendProjectId = formData.get('backendProjectId');
  invariant(typeof backendProjectId === 'string', 'Collection Id is required');
  const remoteId = formData.get('remoteId');
  invariant(typeof remoteId === 'string', 'Remote Id is required');

  const vcs = getVCS();
  invariant(vcs, 'VCS is not defined');

  const remoteBackendProjects = await vcs.remoteBackendProjects(remoteId);
  const backendProject = remoteBackendProjects.find(p => p.id === backendProjectId);

  invariant(backendProject, 'Backend project not found');

  const remoteProjects = await database.find<RemoteProject>(models.project.type, {
    // @ts-expect-error -- Improve database query typing
    $not: {
      remoteId: null,
    },
  });

  // Clone old VCS so we don't mess anything up while working on other backend projects
  const newVCS = vcs.newInstance();
  // Remove all backend projects for workspace first
  await newVCS.removeBackendProjectsForRoot(backendProject.rootDocumentId);

  await pullBackendProject({ vcs: newVCS, backendProject, remoteProjects });
};

export interface RemoteCollectionsLoaderData {
  remoteBackendProjects: BackendProject[];
}

export const remoteCollectionsLoader: LoaderFunction = async ({ params }): Promise<RemoteCollectionsLoaderData> => {
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
