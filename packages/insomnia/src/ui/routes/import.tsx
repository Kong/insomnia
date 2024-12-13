import path from 'node:path';

import type { ActionFunction } from 'react-router-dom';

import type { PostmanDataDumpRawData } from '../../common/import';
import { fetchImportContentFromURI, getFilesFromPostmanExportedDataDump, type ImportFileDetail, importResourcesToProject, importResourcesToWorkspace, scanResources, type ScanResult } from '../../common/import';
import * as models from '../../models';
import { invariant } from '../../utils/invariant';

export const scanForResourcesAction: ActionFunction = async ({ request }): Promise<ScanResult[]> => {
  try {
    const formData = await request.formData();

    const source = formData.get('importFrom');
    invariant(typeof source === 'string', 'Source is required.');
    invariant(['file', 'uri', 'clipboard'].includes(source), 'Unsupported import type');

    const contentList: ImportFileDetail[] = [];
    if (source === 'uri') {
      const uri = formData.get('uri');
      if (typeof uri !== 'string' || uri === '') {
        return [{
          errors: ['URI is required'],
        }];
      }

      contentList.push({
        contentStr: await fetchImportContentFromURI({ uri }),
        oriFileName: uri,
      });
    } else if (source === 'file') {
      let filePaths: string[];
      try {
        filePaths = JSON.parse(formData.get('filePaths') as string);
        if (!Array.isArray(filePaths)) {
          throw new Error();
        }
        filePaths = filePaths.filter(filePath => typeof filePath === 'string' && filePath);
        if (filePaths.length === 0) {
          throw new Error();
        }
      } catch (err) {
        return [{
          errors: ['File is required'],
        }];
      }

      const zipFilePaths = filePaths.filter(filePath => path.extname(filePath) === '.zip');
      const nonZipFilePaths = filePaths.filter(filePath => path.extname(filePath) !== '.zip');

      // zip file is for postman data dump
      for (const zipFilePath of zipFilePaths) {
        let postmanDataDumpRawData: PostmanDataDumpRawData;
        try {
          postmanDataDumpRawData = await getFilesFromPostmanExportedDataDump(zipFilePath);
        } catch (err) {
          return [{
            errors: [err.message],
          }];
        }

        function trans({
          contentStr,
          oriFileName,
        }: ImportFileDetail): ImportFileDetail {
          return {
            contentStr,
            oriFileName: `${oriFileName} in ${path.basename(zipFilePath)}`,
          };
        }

        contentList.push(
          ...postmanDataDumpRawData.collectionList.map(trans),
          ...postmanDataDumpRawData.envList.map(trans)
        );
      }

      for (const filePath of nonZipFilePaths) {
        const uri = `file://${filePath}`;
        contentList.push({
          contentStr: await fetchImportContentFromURI({ uri }),
          oriFileName: path.basename(filePath),
        });
      }
    } else {
      // from clipboard
      contentList.push({
        contentStr: window.clipboard.readText(),
        oriFileName: 'clipboard',
      });
    }

    if (contentList.length === 0) {
      return [{
        errors: ['No content to import'],
      }];
    }

    const result = await scanResources(contentList);

    return result;
  } catch (err) {
    return [{
      errors: [err.message],
    }];
  }
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
