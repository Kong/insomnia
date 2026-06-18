import type { Workspace } from 'insomnia-data';
import { services } from 'insomnia-data';
import { href } from 'react-router';

import {
  clearResourceCache,
  findExistingImportedSpec,
  findRequestInExistingWorkspace,
  importResourcesToProject,
  importResourcesToWorkspace,
} from '~/common/import';
import { invariant } from '~/common/utils/invariant';
import { createFetcherSubmitHook } from '~/ui/utils/router';

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

  const project = await services.project.get(projectId);
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
    const requests =
      singleImportedWorkspace && (await services.helpers.findRequestByParentId(singleImportedWorkspace._id));
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

export async function syncNewWorkspaceIfNeeded(newWorkspace: Workspace) {
  return window.main.syncNewWorkspaceIfNeeded({ workspaceId: newWorkspace._id });
}
