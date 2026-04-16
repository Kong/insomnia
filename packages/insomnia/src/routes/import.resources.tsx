import { href } from 'react-router';

import type { Workspace } from '~/insomnia-data';
import type { ImportScannedResourcesParams, ImportScannedResourcesResult } from '~/main/import';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/import.resources';

export const importScannedResources = async (
  data: ImportScannedResourcesParams,
): Promise<ImportScannedResourcesResult> => {
  return window.main.importScannedResources(data);
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
    return await importScannedResources({
      ...data,
      organizationId,
      projectId,
      workspaceId,
      options,
    });
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
