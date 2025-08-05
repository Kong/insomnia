import { useCallback } from 'react';
import { href, redirect, useFetcher } from 'react-router';

import { importResourcesToNewWorkspace } from '~/common/import';
import { getInsomniaV5DataExport, importInsomniaV5Data } from '~/common/insomnia-v5';
import * as models from '~/models';
import type { Project } from '~/models/project';
import { scopeToActivity } from '~/models/workspace';
import { syncNewWorkspaceIfNeeded } from '~/routes/import.resources';
import { invariant } from '~/utils/invariant';

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

    const oldWorkspace = await models.workspace.getById(oldWorkspaceId);
    invariant(oldWorkspace, 'Workspace not found');

    // duplicate the workspace to the new project
    const newProject = (await models.project.getById(newProjectId)) as Project;
    const workspaceExport = await getInsomniaV5DataExport({
      workspaceId: oldWorkspace._id,
      includePrivateEnvironments: true,
    });

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

    return redirect(
      `${href('/organization/:organizationId/project/:projectId/workspace/:workspaceId', {
        organizationId: newOrgId,
        projectId: newProjectId,
        workspaceId: newWorkspace._id,
      })}/${scopeToActivity(newWorkspace.scope)}`,
    );
  } catch (error) {
    return {
      error: 'Failed to duplicate workspace: ' + (error instanceof Error ? error.message : String(error)),
    };
  }
}

export function useWorkspaceMoveActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
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

      return fetcherSubmit(formData, {
        action: url,
        method: 'POST',
      });
    },
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
