import { type ActionFunctionArgs } from 'react-router';

import * as models from '../../models';
import { invariant } from '../../utils/invariant';

export async function action({ request, params }: ActionFunctionArgs) {
  const { organizationId } = params;

  invariant(typeof organizationId === 'string', 'Organization ID is required');

  const formData = await request.formData();
  const projectId = formData.get('projectId');
  const workspaceId = formData.get('workspaceId');
  invariant(typeof projectId === 'string', 'Project ID is required');
  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');

  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  await models.workspace.update(workspace, {
    parentId: projectId,
  });

  return null;
}
