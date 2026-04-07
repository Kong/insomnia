import { href } from 'react-router';

import { database } from '~/common/database';
import type { Workspace } from '~/insomnia-data';
import * as models from '~/models';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { invariant } from '~/utils/invariant';
import { createFetcherLoadHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId, projectId } = params;
  invariant(typeof organizationId === 'string', 'Organization Id is required');
  invariant(typeof projectId === 'string', 'Project Id is required');

  try {
    const project = await models.project.getById(projectId);
    invariant(project, 'Project not found');

    const remoteId = project.remoteId;
    if (!remoteId) {
      return {
        backendProjectsToPull: [],
      };
    }
    const vcs = VCSInstance();

    const allPulledBackendProjectsForRemoteId = (await vcs.localBackendProjects()).filter(p => p.id === remoteId);
    // Remote backend projects are fetched from the backend since they are not stored locally
    const allFetchedRemoteBackendProjectsForRemoteId = await vcs.remoteBackendProjects({
      teamId: organizationId,
      teamProjectId: remoteId,
    });

    // Get all workspaces that are connected to backend projects and under the current project
    const workspacesWithBackendProjects = await database.find<Workspace>(models.workspace.type, {
      _id: {
        $in: [...allPulledBackendProjectsForRemoteId, ...allFetchedRemoteBackendProjectsForRemoteId].map(
          p => p.rootDocumentId,
        ),
      },
      parentId: project._id,
    });

    // Get the list of remote backend projects that we need to pull
    const backendProjectsToPull = allFetchedRemoteBackendProjectsForRemoteId.filter(
      p => !workspacesWithBackendProjects.find(w => w._id === p.rootDocumentId),
    );

    return {
      backendProjectsToPull,
    };
  } catch (e) {
    console.warn('Failed to load backend projects', e);
  }

  return {
    backendProjectsToPull: [],
  };
}

export const useInsomniaSyncLoaderFetcher = createFetcherLoadHook(
  load =>
    ({
      organizationId,
      projectId,
      workspaceId,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
    }) => {
      const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/insomnia-sync', {
        organizationId,
        projectId,
        workspaceId,
      });

      return load(url);
    },
);
