import type { Project } from 'insomnia-data';
import { services } from 'insomnia-data';
import { href } from 'react-router';

import { importResourcesToNewWorkspace } from '~/common/import';
import { getInsomniaV5DataExport, importInsomniaV5Data } from '~/common/insomnia-v5';
import { invariant } from '~/common/utils/invariant';
import { syncNewWorkspaceIfNeeded } from '~/routes/import.resources';
import { showError } from '~/ui/components/modals';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.move';

/** Duplicate workspace to other project and automatically sync to cloud if needed  */
export async function clientAction({ request }: Route.ClientActionArgs) {
  try {
    const formData = await request.formData();
    const oldWorkspaceId = formData.get('workspaceId') as string;
    invariant(oldWorkspaceId, 'Workspace ID is required');
    const newOrgId = formData.get('orgId') as string;
    invariant(newOrgId, 'Org ID is required');
    const newProjectId = formData.get('projectId') as string;
    invariant(newProjectId, 'Project ID is required');
    const newWorkspaceName = formData.get('name') as string;

    const oldWorkspace = await services.workspace.getById(oldWorkspaceId);
    invariant(oldWorkspace, 'Workspace not found');

    // duplicate the workspace to the new project
    const newProject = (await services.project.getById(newProjectId)) as Project;
    const { yaml: workspaceExport, errors: exportErrors } = await getInsomniaV5DataExport({
      workspaceId: oldWorkspace._id,
      includePrivateEnvironments: true,
    });

    // The export feeds the import below, so anything missing from it is lost for good.
    // Refuse the move instead of quietly moving an incomplete workspace.
    invariant(
      exportErrors.length === 0 && workspaceExport,
      `workspace export failed schema validation: ${exportErrors
        .map(error => `${error.name} (${error.entityType})`)
        .join(', ')}`,
    );

    const data = importInsomniaV5Data(workspaceExport);

    const newWorkspace = await importResourcesToNewWorkspace({
      projectId: newProject._id,
      workspaceToImport: {
        ...oldWorkspace,
        name: newWorkspaceName || oldWorkspace.name,
      },
      resourceCacheItem: {
        resources: data,
        content: JSON.stringify(data, null, 2),
        importer: {
          id: 'insomnia-v5',
          name: 'Insomnia v5 Importer',
          description: 'Import Insomnia v5 data',
        },
      },
      syncNewWorkspaceIfNeeded,
    });
    return {
      organizationId: newOrgId,
      projectId: newProjectId,
      workspaceId: newWorkspace._id,
      workspaceScope: newWorkspace.scope,
    };
  } catch (error) {
    // Nothing consumes this action's error, and a rejected duplicate has to be visible.
    showError({
      title: 'Duplicate Workspace Failed',
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return {
      error: 'Failed to duplicate workspace: ' + (error instanceof Error ? error.message : String(error)),
    };
  }
}

export const useWorkspaceMoveActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      workspaceId,
      orgId,
      projectId,
      name,
    }: {
      workspaceId: string;
      orgId: string;
      projectId: string;
      name?: string;
    }) => {
      const formData = new FormData();
      formData.append('workspaceId', workspaceId);
      formData.append('orgId', orgId);
      formData.append('projectId', projectId);
      if (name) {
        formData.append('name', name);
      }

      const url = href('/organization/:organizationId/project/:projectId/workspace/move', {
        organizationId: orgId,
        projectId,
      });

      return submit(formData, {
        action: url,
        method: 'POST',
      });
    },
  clientAction,
);
