// Import
import { ActionFunction } from 'react-router-dom';

import { fetchImportContentFromURI, importResourcesToProject, importResourcesToWorkspace, scanResources, ScanResult } from '../../common/import';
import * as models from '../../models';
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
    content = window.clipboard.readText();
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
  done: boolean;
}

export const importResourcesAction: ActionFunction = async ({ request }): Promise<ImportResourcesActionResult> => {
  const formData = await request.formData();

  const organizationId = formData.get('organizationId');
  const projectId = formData.get('projectId');
  const workspaceId = formData.get('workspaceId');

  invariant(typeof organizationId === 'string', 'OrganizationId is required.');
  invariant(typeof projectId === 'string', 'ProjectId is required.');

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found.');
  if (typeof workspaceId === 'string' && workspaceId) {
    await importResourcesToWorkspace({
      workspaceId: workspaceId,
    });
    // TODO: find more elegant way to wait for import to finish
    return { done: true };
  }

  await importResourcesToProject({ projectId: project._id });
  return { done: true };
};
