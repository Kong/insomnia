import { href } from 'react-router';

import { importResourcesToProject, importResourcesToWorkspace } from '~/common/import';
import * as models from '~/models';
import { isRemoteProject } from '~/models/project';
import type { Workspace } from '~/models/workspace';
import {
  initializeLocalBackendProjectAndMarkForSync,
  pushSnapshotOnInitialize,
} from '~/sync/vcs/initialize-backend-project';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { fetchAndCacheOrganizationStorageRule } from '~/ui/organization-utils';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/import.resources';

export const importScannedResources = async ({
  organizationId,
  projectId,
  workspaceId,
}: {
  organizationId: string;
  projectId: string;
  workspaceId?: string;
}) => {
  invariant(organizationId && typeof organizationId === 'string', 'OrganizationId is required.');
  invariant(projectId && typeof projectId === 'string', 'ProjectId is required.');

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found.');

  await (typeof workspaceId === 'string' && workspaceId
    ? importResourcesToWorkspace({
        workspaceId: workspaceId,
      })
    : importResourcesToProject({
        projectId: project._id,
        syncNewWorkspaceIfNeeded,
      }));
};

export async function clientAction({ request }: Route.ClientActionArgs) {
  try {
    const data = (await request.json()) as {
      organizationId: string;
      projectId: string;
      workspaceId?: string;
    };

    const organizationId = data.organizationId;
    const projectId = data.projectId;
    const workspaceId = data.workspaceId;

    invariant(typeof organizationId === 'string', 'OrganizationId is required.');
    invariant(typeof projectId === 'string', 'ProjectId is required.');

    await importScannedResources({
      organizationId,
      projectId,
      workspaceId,
    });
    return { done: true };
  } catch (error) {
    console.error('Failed to import resources:', error);
    return {
      errors: ['Failed to import resources.'],
    };
  }
}

export const useImportResourcesFetcher = createFetcherSubmitHook(
  submit => (data: { organizationId: string; projectId: string; workspaceId?: string }) => {
    submit(JSON.stringify(data), {
      action: href('/import/resources'),
      method: 'POST',
      encType: 'application/json',
    });
  },
  clientAction,
);

// The reason why we put this function here is because this function indirectly depends on some modules that can only run in a browser environment.
// If we put this function in import.ts which is depended by Inso CLI, Inso CLI will fail to build because it doesn't have access to the browser environment.
// So we put this function here and pass it to importResourcesToProject func to avoid the dependency issue.
export async function syncNewWorkspaceIfNeeded(newWorkspace: Workspace) {
  const project = await models.project.getById(newWorkspace.parentId);
  invariant(project, 'Project not found');
  const userSession = await models.userSession.getOrCreate();

  if (userSession.id && isRemoteProject(project)) {
    const storageRules = await fetchAndCacheOrganizationStorageRule(project.parentId);
    invariant(storageRules, 'Storage rules not found');

    if (storageRules.enableCloudSync) {
      // Create default env, cookie jar, and meta
      await models.environment.getOrCreateForParentId(newWorkspace._id);
      await models.cookieJar.getOrCreateForParentId(newWorkspace._id);
      await models.workspaceMeta.getOrCreateByParentId(newWorkspace._id);
      try {
        const vcs = VCSInstance().newInstance();
        await initializeLocalBackendProjectAndMarkForSync({
          vcs,
          workspace: newWorkspace,
        });
        await pushSnapshotOnInitialize({
          vcs,
          workspace: newWorkspace,
          project,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.warn(
          `Failed to initialize sync to insomnia cloud for workspace ${newWorkspace._id}. This will be retried when the workspace is opened on the app. ${errorMessage}`,
        );
      }
    }
  }
}
