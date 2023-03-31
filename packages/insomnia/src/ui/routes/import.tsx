// Import
import { clipboard } from 'electron';
import { ActionFunction, redirect } from 'react-router-dom';

import { ACTIVITY_DEBUG, ACTIVITY_SPEC } from '../../common/constants';
import { fetchImportContentFromURI, importResources, scanResources, ScanResult } from '../../common/import';
import * as models from '../../models';
import { WorkspaceScope } from '../../models/workspace';
import { invariant } from '../../utils/invariant';

function guard<T>(condition: any, value: any): asserts value is T {
  if (!condition) {
    throw new Error('Guard failed');
  }

  return value;
}

export interface ScanForResourcesActionResult extends ScanResult {}

export const scanForResourcesAction: ActionFunction = async ({ request }): Promise<ScanForResourcesActionResult> => {
  const formData = await request.formData();

  const source = formData.get('importFrom');
  invariant(typeof source === 'string', 'Source is required.');
  guard<'file' | 'uri' | 'clipboard'>(source, ['file', 'uri', 'clipboard'].includes(source));

  let content = '';
  if (source === 'uri') {
    const uri = formData.get('uri');
    if (typeof uri !== 'string' || uri === '') {
      return {
        errors: ['URI is required'],
      };
    }

    content = await fetchImportContentFromURI({
      uri,
    });
  } else if (source === 'file') {
    const filePath = formData.get('filePath');
    if (typeof filePath !== 'string' || filePath === '') {
      return {
        errors: ['File is required'],
      };
    }
    const uri = `file://${filePath}`;

    content = await fetchImportContentFromURI({
      uri,
    });
  } else {
    content = clipboard.readText();
  }

  if (!content) {
    return {
      errors: ['No content to import'],
    };
  }

  const result = await scanResources({ content });

  return result;
};

export interface ImportResourcesActionResult {
  errors?: string[];
}

export const importResourcesAction: ActionFunction = async ({ request }): Promise<ImportResourcesActionResult | Response> => {
  const formData = await request.formData();

  const organizationId = formData.get('organizationId');
  const projectId = formData.get('projectId');
  const workspaceId = formData.get('workspaceId');
  const scope = formData.get('scope') || 'design';
  const name = formData.get('name');

  const workspaceName = typeof name === 'string' ? name : 'Untitled';

  invariant(typeof organizationId === 'string', 'OrganizationId is required.');
  invariant(typeof projectId === 'string', 'ProjectId is required.');
  invariant(typeof workspaceId === 'string', 'WorkspaceId is required.');
  invariant(typeof scope === 'string', 'Scope is required.');

  guard<WorkspaceScope>(scope === 'design' || scope === 'collection', scope);

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found.');

  const result = await importResources({
    projectId: project._id,
    workspaceId,
    workspaceName,
  });

  return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${result.workspace._id}/${
    result.workspace.scope === 'design'
      ? ACTIVITY_SPEC
      : ACTIVITY_DEBUG
  }`);
};
