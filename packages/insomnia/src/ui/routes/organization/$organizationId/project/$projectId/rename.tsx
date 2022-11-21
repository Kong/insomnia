import * as models from '@insomnia/models';
import { isRemoteProject } from '@insomnia/models/project';
import { invariant } from '@remix-run/router';
import { ActionFunction } from 'react-router-dom';

export const action: ActionFunction = async ({
  request, params,
}) => {
  const formData = await request.formData();

  const name = formData.get('name');
  invariant(typeof name === 'string', 'Name is required');

  const { projectId } = params;
  invariant(projectId, 'Project ID is required');

  const project = await models.project.getById(projectId);

  invariant(project, 'Project not found');

  invariant(
    !isRemoteProject(project),
    'Cannot rename remote project'
  );

  await models.project.update(project, { name });
};
