import type { Project, Workspace } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { href, redirect } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import { AnalyticsEvent } from '~/ui/analytics';
import uiEventBus, { CLOUD_SYNC_FILE_CHANGE } from '~/ui/event-bus';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.delete';

async function deleteCloudSyncWorkspace(workspace: Workspace, project: Project, localOnly: boolean) {
  const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(workspace._id);
  const isGitSync = !!workspaceMeta.gitRepositoryId;

  if (models.project.isRemoteProject(project) && !isGitSync) {
    try {
      await window.main.sync.switchAndCreateBackendProjectIfNotExist(workspace._id, workspace.name);
      // For cloud sync workspaces, delete only local file or also delete remote copy
      await (localOnly
        ? window.main.sync.removeBackendProjectsForRoot(workspace._id)
        : window.main.sync.archiveProject());
      // Emit cloud sync file change event when cloud sync workspace is deleted to refresh the remote projects list cache
      uiEventBus.emit(CLOUD_SYNC_FILE_CHANGE);
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
  await services.stats.incrementDeletedRequestsForDescendents(workspace);
  await services.workspace.remove(workspace);
}

async function deleteWorkspace(workspace: Workspace | null, project: Project | null, localOnly: boolean) {
  invariant(workspace, 'Workspace not found');
  invariant(project, 'Project not found');

  const ret = await deleteCloudSyncWorkspace(workspace, project, localOnly);
  if (ret?.error) {
    return ret;
  }

  await deleteWorkspaceFromLocal(workspace);

  if (workspace.scope === 'mock-server') {
    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.mockDelete,
    });
  }

  return null;
}

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { organizationId, projectId } = params;

  const project = await services.project.get(projectId);
  invariant(project, 'Project not found');
  const formData = await request.formData();

  const workspaceId = formData.get('workspaceId');
  const localOnly = formData.get('localOnly') === 'true';
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const workspace = await services.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const msgObj = await deleteWorkspace(workspace, project, localOnly);

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
      // for cloud sync workspaces, delete only local file or also delete remote copy
      localOnly = 'true',
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      localOnly?: 'true' | 'false';
    }) => {
      const url = href('/organization/:organizationId/project/:projectId/workspace/delete', {
        organizationId,
        projectId,
      });

      const formData = new FormData();
      formData.append('workspaceId', workspaceId);
      formData.append('localOnly', localOnly);

      return submit(formData, {
        action: url,
        method: 'POST',
      });
    },
  clientAction,
);
