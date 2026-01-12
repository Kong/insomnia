import { href, redirect } from 'react-router';

import * as models from '~/models';
import { isRemoteProject, type Project } from '~/models/project';
import { type Workspace } from '~/models/workspace';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { SegmentEvent } from '~/ui/analytics';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.delete';

async function deleteWorkspaceFromCloud(workspace: Workspace, project: Project) {
  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);
  const isGitSync = !!workspaceMeta.gitRepositoryId;

  if (isRemoteProject(project) && !isGitSync) {
    try {
      const vcs = VCSInstance();
      await vcs.switchAndCreateBackendProjectIfNotExist(workspace._id, workspace.name);
      await vcs.archiveProject();
    } catch (err) {
      return {
        error:
          err instanceof Error
            ? err.message
            : `An unexpected error occurred while deleting the workspace. Please try again. ${err}`,
      };
    }
  }

  return null;
}

async function deleteWorkspaceFromLocal(workspace: Workspace) {
  await models.stats.incrementDeletedRequestsForDescendents(workspace);
  await models.workspace.remove(workspace);
}

async function deleteWorkspace(workspace: Workspace | null, project: Project | null) {
  invariant(workspace, 'Workspace not found');
  invariant(project, 'Project not found');

  const ret = await deleteWorkspaceFromCloud(workspace, project);
  if (ret?.error) {
    return ret;
  }

  await deleteWorkspaceFromLocal(workspace);

  if (workspace.scope === 'mock-server') {
    window.main.trackSegmentEvent({
      event: SegmentEvent.mockDelete,
    });
  }

  return null;
}

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { organizationId, projectId } = params;

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');
  const formData = await request.formData();

  const workspaceId = formData.get('workspaceId');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const msgObj = await deleteWorkspace(workspace, project);

  if (msgObj?.error) {
    return msgObj;
  }

  return redirect(
    href(`/organization/:organizationId/project/:projectId`, {
      organizationId,
      projectId,
    }),
  );
}

export const useWorkspaceDeleteActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
    }) => {
      const url = href('/organization/:organizationId/project/:projectId/workspace/delete', {
        organizationId,
        projectId,
      });

      const formData = new FormData();
      formData.append('workspaceId', workspaceId);

      return submit(formData, {
        action: url,
        method: 'POST',
      });
    },
  clientAction,
);
