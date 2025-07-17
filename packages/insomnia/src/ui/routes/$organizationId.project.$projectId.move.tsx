import { type ActionFunctionArgs } from 'react-router';

import * as models from '../../models';
import { invariant } from '../../utils/invariant';

export async function action({ request, params }: ActionFunctionArgs) {
  const { projectId } = params as { projectId: string };
  const formData = await request.formData();

  const organizationId = formData.get('organizationId');

  invariant(typeof organizationId === 'string', 'Organization ID is required');
  invariant(typeof projectId === 'string', 'Project ID is required');

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');

  await models.project.update(project, {
    parentId: organizationId,
    // We move a project to another organization as local no matter what it was before
    remoteId: null,
  });

  return null;
}
