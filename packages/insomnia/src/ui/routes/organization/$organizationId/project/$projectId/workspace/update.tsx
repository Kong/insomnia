import * as models from '@insomnia/models';
import { invariant } from '@remix-run/router';
import { ActionFunction } from 'react-router-dom';

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const workspaceId = formData.get('workspaceId');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const name = formData.get('name');
  invariant(typeof name === 'string', 'Name is required');

  const description = formData.get('description');
  if (description) {
    invariant(typeof description === 'string', 'Description is required');
  }

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  if (workspace.scope === 'design') {
    const apiSpec = await models.apiSpec.getByParentId(workspaceId);
    invariant(apiSpec, 'No Api Spec found for this workspace');

    await models.apiSpec.update(apiSpec, {
      fileName: name,
    });
  }

  await models.workspace.update(workspace, {
    name,
    description: description || workspace.description,
  });
};
