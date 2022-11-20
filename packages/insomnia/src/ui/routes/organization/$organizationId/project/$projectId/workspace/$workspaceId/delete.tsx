import * as models from '@insomnia/models';
import { getVCS } from '@insomnia/sync/vcs/vcs';
import { invariant } from '@remix-run/router';
import { ActionFunction, redirect } from 'react-router-dom';

export const action: ActionFunction = async ({
  params, request,
}) => {
  const { organizationId, projectId } = params;
  invariant(projectId, 'projectId is required');

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');

  const formData = await request.formData();

  const workspaceId = formData.get('workspaceId');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  await models.stats.incrementDeletedRequestsForDescendents(workspace);
  await models.workspace.remove(workspace);

  try {
    const vcs = getVCS();
    if (vcs) {
      const backendProject = await vcs._getBackendProjectByRootDocument(workspace._id);
      await vcs._removeProject(backendProject);

      console.log({ projectsLOCAL: await vcs.localBackendProjects() });
    }
  } catch (err) {
    console.warn('Failed to remove project from VCS', err);
  }

  return redirect(`/organization/${organizationId}/project/${projectId}`);
};
