import { type ActionFunctionArgs, redirect } from 'react-router';

import { importResourcesToNewWorkspace } from '../../common/import';
import { getInsomniaV5DataExport, importInsomniaV5Data } from '../../common/insomnia-v5';
import * as models from '../../models';
import type { Project } from '../../models/project';
import { scopeToActivity } from '../../models/workspace';
import { invariant } from '../../utils/invariant';
import { syncNewWorkspaceIfNeeded } from './import';

/** Duplicate workspace to other project and automatically sync to cloud if needed  */
export async function action({ request, params }: ActionFunctionArgs) {
  const { organizationId, projectId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');
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
    `/organization/${newOrgId}/project/${newProjectId}/workspace/${newWorkspace._id}/${scopeToActivity(newWorkspace.scope)}`,
  );
}
