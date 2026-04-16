import { app } from 'electron';

import { fetchAndCacheOrganizationStorageRule } from '~/common/organization-storage-rules';
import { services } from '~/insomnia-data';
import * as models from '~/models';
import { createVCS } from '~/sync/vcs/create-vcs';
import { initializeLocalBackendProjectAndMarkForSync, pushSnapshotOnInitialize } from '~/sync/vcs/initialize-backend-project';
import { invariant } from '~/utils/invariant';

const createMainVCS = () =>
  createVCS({
    dataPath: process.env['INSOMNIA_DATA_PATH'] || app.getPath('userData'),
  });

export const initializeWorkspaceBackendProject = async ({ workspaceId }: { workspaceId: string }) => {
  const workspace = await services.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const { id } = await services.userSession.getOrCreate();
  if (!id) {
    return;
  }

  const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(workspaceId);
  if (workspaceMeta.gitRepositoryId) {
    return;
  }

  const vcs = createMainVCS();
  await initializeLocalBackendProjectAndMarkForSync({
    vcs,
    workspace,
  });
};

export const syncNewWorkspaceIfNeeded = async ({ workspaceId }: { workspaceId: string }) => {
  const workspace = await services.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const project = await services.project.getById(workspace.parentId);
  invariant(project, 'Project not found');

  const userSession = await services.userSession.getOrCreate();
  if (!userSession.id || !models.project.isRemoteProject(project)) {
    return;
  }

  const storageRules = await fetchAndCacheOrganizationStorageRule(project.parentId);
  invariant(storageRules, 'Storage rules not found');

  if (!storageRules.enableCloudSync) {
    return;
  }

  await services.environment.getOrCreateForParentId(workspace._id);
  await services.cookieJar.getOrCreateForParentId(workspace._id);
  await services.workspaceMeta.getOrCreateByParentId(workspace._id);

  try {
    const vcs = createMainVCS();
    await initializeLocalBackendProjectAndMarkForSync({
      vcs,
      workspace,
    });
    await pushSnapshotOnInitialize({
      vcs,
      workspace,
      project,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.warn(
      `Failed to initialize sync to insomnia cloud for workspace ${workspace._id}. This will be retried when the workspace is opened on the app. ${errorMessage}`,
    );
  }
};
