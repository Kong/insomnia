// Import
import { clipboard } from 'electron';
import { ActionFunction, redirect } from 'react-router-dom';

import { ACTIVITY_DEBUG, ACTIVITY_SPEC } from '../../common/constants';
import { fetchImportContentFromURI, importResourcesToProject, importResourcesToWorkspace, scanResources, ScanResult } from '../../common/import';
import * as models from '../../models';
import { DEFAULT_PROJECT_ID } from '../../models/project';
import { invariant } from '../../utils/invariant';

export interface ScanForResourcesActionResult extends ScanResult { }

export const scanForResourcesAction: ActionFunction = async ({ request }): Promise<ScanForResourcesActionResult> => {
  const formData = await request.formData();

  const source = formData.get('importFrom');
  invariant(typeof source === 'string', 'Source is required.');
  invariant(['file', 'uri', 'clipboard'].includes(source), 'Unsupported import type');

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
  let projectId = formData.get('projectId');
  const workspaceId = formData.get('workspaceId');

  invariant(typeof organizationId === 'string', 'OrganizationId is required.');
  // when importing through insomnia://app/import, projectId is not provided
  if (typeof projectId !== 'string' || !projectId) {
    projectId = DEFAULT_PROJECT_ID;
  }

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found.');
  if (typeof workspaceId === 'string' && workspaceId) {
    const result = await importResourcesToWorkspace({
      workspaceId: workspaceId,
    });
    return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${result.workspace._id}/${result.workspace.scope === 'design'
      ? ACTIVITY_SPEC : ACTIVITY_DEBUG}`);
  }

  await importResourcesToProject({ projectId: project._id });
  return redirect(`/organization/${organizationId}/project/${projectId}`);
};
