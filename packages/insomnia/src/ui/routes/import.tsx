// Import
import { clipboard } from 'electron';
import { ActionFunction } from 'react-router-dom';

import { fetchImportContentFromURI, importResources, scanResources } from '../../common/import';
import * as models from '../../models';
import { WorkspaceScope } from '../../models/workspace';
import { invariant } from '../../utils/invariant';

function guard<T>(condition: any, value: any): asserts value is T {
  if (!condition) {
    throw new Error('Guard failed');
  }
}

export const scanForResourcesAction: ActionFunction = async ({ request }) => {
  const formData = await request.formData();

  const source = formData.get('importFrom');
  invariant(typeof source === 'string', 'Source is required.');
  guard<'file' | 'uri' | 'clipboard'>(source, ['file', 'uri', 'clipboard'].includes(source));

  let content = '';
  if (source === 'uri') {
    const uri = formData.get('uri');
    invariant(typeof uri === 'string', 'URI is required.');

    content = await fetchImportContentFromURI({
      uri,
    });
  } else if (source === 'file') {
    const filePath = formData.get('filePath');
    invariant(typeof filePath === 'string', 'URI is required.');
    const uri = `file://${filePath}`;

    content = await fetchImportContentFromURI({
      uri,
    });
  } else {
    content = clipboard.readText();
  }

  if (!content) {
    throw new Error('The URI does not contain a valid specification.');
  }

  const result = await scanResources({ content });

  return result;
};

export const importResourcesAction: ActionFunction = async ({ request }) => {
  const formData = await request.formData();

  const resourceIds = formData.getAll('resourceId') as string[];

  const organizationId = formData.get('organizationId');
  const projectId = formData.get('projectId');
  const workspaceId = formData.get('workspaceId');
  const scope = formData.get('scope') || 'design';
  const name = formData.get('name');

  const workspaceName = typeof name === 'string' ? name : 'Untitled';

  console.log({ resourceIds, workspaceId });

  invariant(typeof organizationId === 'string', 'OrganizationId is required.');
  invariant(typeof projectId === 'string', 'ProjectId is required.');
  invariant(typeof workspaceId === 'string', 'WorkspaceId is required.');
  invariant(typeof scope === 'string', 'Scope is required.');

  guard<WorkspaceScope>(scope === 'design' || scope === 'collection', scope);

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found.');

  const result = await importResources({
    resourceIds,
    projectId: project._id,
    workspaceId,
    workspaceName,
  });

  return result;
};
