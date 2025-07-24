import type { ActionFunctionArgs } from 'react-router';

import { importResourcesToProject, importResourcesToWorkspace } from '../../common/import';
import * as models from '../../models';
import { isRemoteProject } from '../../models/project';
import type { Workspace } from '../../models/workspace';
import {
  initializeLocalBackendProjectAndMarkForSync,
  pushSnapshotOnInitialize,
} from '../../sync/vcs/initialize-backend-project';
import { VCSInstance } from '../../sync/vcs/insomnia-sync';
import { invariant } from '../../utils/invariant';
import { fetchAndCacheOrganizationStorageRule } from '../organization-utils';

export interface ImportResourcesActionResult {
  errors?: string[];
  done: boolean;
}

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

  if (typeof workspaceId === 'string' && workspaceId) {
    await importResourcesToWorkspace({
      workspaceId: workspaceId,
    });
  } else {
    await importResourcesToProject({
      projectId: project._id,
      syncNewWorkspaceIfNeeded,
    });
  }
};

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();

    await importScannedResources({
      organizationId: formData.get('organizationId') as string,
      projectId: formData.get('projectId') as string,
      workspaceId: formData.get('workspaceId') as string | undefined,
    });

    // TODO: find more elegant way to wait for import to finish
    return { done: true };
  } catch (error) {
    return {
      errors: [error instanceof Error ? error.message : 'An unknown error occurred'],
      done: false,
    };
  }
}

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
      } catch (e) {
        console.warn(
          `Failed to initialize sync to insomnia cloud for workspace ${newWorkspace._id}. This will be retried when the workspace is opened on the app. ${e.message}`,
        );
      }
    }
  }
}
