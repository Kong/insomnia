import { href } from 'react-router';

import {
  clearResourceCache,
  findExistingImportedSpec,
  findRequestInExistingWorkspace,
  importResourcesToProject,
  importResourcesToWorkspace,
} from '~/common/import';
import type { Workspace } from '~/insomnia-data';
import { services } from '~/insomnia-data';
import * as models from '~/models';
import * as requestOperations from '~/models/helpers/request-operations';
import { isRemoteProject } from '~/models/project';
import {
  initializeLocalBackendProjectAndMarkForSync,
  pushSnapshotOnInitialize,
} from '~/sync/vcs/initialize-backend-project';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { fetchAndCacheOrganizationStorageRule } from '~/ui/organization-utils';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/import.resources';

interface ImportScannedResourcesParams {
  organizationId: string;
  projectId: string;
  workspaceId?: string;
  endpoint?: string;
  operationId?: string;
  skipImportIfDuplicate?: boolean;
  options?: {
    overrideBaseEnvironmentData?: boolean;
  };
}

export const importScannedResources = async ({
  organizationId,
  projectId,
  workspaceId,
  options,
}: ImportScannedResourcesParams) => {
  invariant(organizationId && typeof organizationId === 'string', 'OrganizationId is required.');
  invariant(projectId && typeof projectId === 'string', 'ProjectId is required.');

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found.');

  return await (typeof workspaceId === 'string' && workspaceId
    ? importResourcesToWorkspace({
        workspaceId: workspaceId,
        overrideBaseEnvironmentData: options?.overrideBaseEnvironmentData ?? true,
      })
    : importResourcesToProject({
        projectId: project._id,
        syncNewWorkspaceIfNeeded,
      }));
};

export async function clientAction({ request }: Route.ClientActionArgs) {
  try {
    const data = (await request.json()) as ImportScannedResourcesParams;

    const organizationId = data.organizationId;
    const projectId = data.projectId;
    const workspaceId = data.workspaceId;
    const options = data.options;

    invariant(typeof organizationId === 'string', 'OrganizationId is required.');
    invariant(typeof projectId === 'string', 'ProjectId is required.');

    if (!workspaceId && data.skipImportIfDuplicate) {
      const existing = await findExistingImportedSpec(projectId, organizationId);
      if (existing) {
        const matchedRequest = await findRequestInExistingWorkspace(
          existing.workspace,
          data.endpoint,
          data.operationId,
        );
        clearResourceCache(); // skipping import to navigate to existing, avoid stale resource cache
        return {
          done: true,
          singleImportedWorkspace: existing.workspace,
          singleImportedRequest: matchedRequest,
          singleImportedProjectId: existing.workspace.parentId,
        };
      }
    }

    const importedWorkspaces = await importScannedResources({
      organizationId,
      projectId,
      workspaceId,
      options,
    });

    if (data.endpoint || data.operationId) {
      for (const ws of importedWorkspaces) {
        if (!ws) continue;
        const foundDeepLinkedRequest = await findRequestInExistingWorkspace(ws, data.endpoint, data.operationId);
        if (foundDeepLinkedRequest) {
          return { done: true, singleImportedWorkspace: ws, singleImportedRequest: foundDeepLinkedRequest };
        }
      }
    }

    // When navigating, we are interested in knowing if there was only one workspace and only one request
    const singleImportedWorkspace =
      Array.isArray(importedWorkspaces) && importedWorkspaces.length === 1 && importedWorkspaces[0];
    const requests = singleImportedWorkspace && (await requestOperations.findByParentId(singleImportedWorkspace._id));
    const singleImportedRequest = Array.isArray(requests) && requests.length === 1 && requests.at(0);
    return { done: true, singleImportedWorkspace, singleImportedRequest };
  } catch (error) {
    console.error('Failed to import resources:', error);
    return {
      errors: ['Failed to import resources.'],
    };
  }
}

export const useImportResourcesFetcher = createFetcherSubmitHook(
  submit => (data: ImportScannedResourcesParams) => {
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
  const userSession = await services.userSession.getOrCreate();

  if (userSession.id && isRemoteProject(project)) {
    const storageRules = await fetchAndCacheOrganizationStorageRule(project.parentId);
    invariant(storageRules, 'Storage rules not found');

    if (storageRules.enableCloudSync) {
      // Create default env, cookie jar, and meta
      await models.environment.getOrCreateForParentId(newWorkspace._id);
      await models.cookieJar.getOrCreateForParentId(newWorkspace._id);
      await services.workspaceMeta.getOrCreateByParentId(newWorkspace._id);
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
