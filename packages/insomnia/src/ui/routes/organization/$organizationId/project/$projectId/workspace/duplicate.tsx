import * as session from '@insomnia/account/session';
import { ACTIVITY_DEBUG, ACTIVITY_SPEC } from '@insomnia/common/constants';
import * as models from '@insomnia/models';
import * as workspaceOperations from '@insomnia/models/helpers/workspace-operations';
import { isRemoteProject } from '@insomnia/models/project';
import { initializeLocalBackendProjectAndMarkForSync } from '@insomnia/sync/vcs/initialize-backend-project';
import { getVCS } from '@insomnia/sync/vcs/vcs';
import { invariant } from '@remix-run/router';
import { ActionFunction, redirect } from 'react-router-dom';

export const action: ActionFunction = async ({ request, params }) => {
  const { organizationId } = params;
  invariant(organizationId, 'Organization Id is required');
  const formData = await request.formData();
  const projectId = formData.get('projectId');
  invariant(typeof projectId === 'string', 'Project ID is required');

  const workspaceId = formData.get('workspaceId');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const name = formData.get('name') || '';
  invariant(typeof name === 'string', 'Name is required');

  const duplicateToProject = await models.project.getById(projectId);
  invariant(duplicateToProject, 'Project not found');

  const newWorkspace = await workspaceOperations.duplicate(workspace, {
    name,
    parentId: projectId,
  });

  await models.workspace.ensureChildren(newWorkspace);

  try {
    // Mark for sync if logged in and in the expected project
    const vcs = getVCS();
    if (session.isLoggedIn() && vcs && isRemoteProject(duplicateToProject)) {
      await initializeLocalBackendProjectAndMarkForSync({
        vcs: vcs.newInstance(),
        workspace: newWorkspace,
      });
    }
  } catch (e) {
    console.warn('Failed to initialize local backend project', e);
  }

  return redirect(
    `/organization/${organizationId}/project/${projectId}/workspace/${newWorkspace._id}/${newWorkspace.scope === 'collection' ? ACTIVITY_DEBUG : ACTIVITY_SPEC}`
  );
};
