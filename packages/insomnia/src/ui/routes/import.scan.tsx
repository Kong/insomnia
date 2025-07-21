import path from 'node:path';

import type { ActionFunctionArgs } from 'react-router';

import type { PostmanDataDumpRawData } from '../../common/import';
import { fetchImportContentFromURI, getFilesFromPostmanExportedDataDump, scanResources } from '../../common/import';
import type { ImportEntry } from '../../utils/importers/entities';
import { invariant } from '../../utils/invariant';
import { SegmentEvent } from '../analytics';

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();

    const source = formData.get('importFrom');
    invariant(typeof source === 'string', 'Source is required.');
    invariant(['file', 'uri', 'clipboard'].includes(source), 'Unsupported import type');

    window.main.trackSegmentEvent({
      event: SegmentEvent.importScanned,
      properties: {
        source,
      },
    });

    const contentList: ImportEntry[] = [];
    if (source === 'uri') {
      const uri = formData.get('uri');
      if (typeof uri !== 'string' || uri === '') {
        return [
          {
            errors: ['URI is required'],
          },
        ];
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
          throw new Error('filePaths is not an array');
        }
        filePaths = filePaths.filter(filePath => typeof filePath === 'string' && filePath);
        if (filePaths.length === 0) {
          throw new Error('filePaths is empty');
        }
      } catch {
        return [
          {
            errors: ['File is required'],
          },
        ];
      }

      const zipFilePaths = filePaths.filter(filePath => path.extname(filePath) === '.zip');
      const nonZipFilePaths = filePaths.filter(filePath => path.extname(filePath) !== '.zip');

      // zip file is for postman data dump
      for (const zipFilePath of zipFilePaths) {
        let postmanDataDumpRawData: PostmanDataDumpRawData;
        try {
          postmanDataDumpRawData = await getFilesFromPostmanExportedDataDump(zipFilePath);
        } catch (err) {
          return [
            {
              errors: [err.message],
            },
          ];
        }

        function trans({ contentStr, oriFileName }: ImportEntry): ImportEntry {
          return {
            contentStr,
            oriFileName: `${oriFileName} in ${path.basename(zipFilePath)}`,
          };
        }

        contentList.push(
          ...postmanDataDumpRawData.collectionList.map(trans),
          ...postmanDataDumpRawData.envList.map(trans),
        );
      }

      for (const filePath of nonZipFilePaths) {
        const uri = `file://${filePath}`;
        contentList.push({
          contentStr: await fetchImportContentFromURI({ uri }),
          oriFileName: path.basename(filePath),
          oriFilePath: filePath,
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
      return [
        {
          errors: ['No content to import'],
        },
      ];
    }

    const result = await scanResources(contentList);

    return result;
  } catch (err) {
    return [
      {
        errors: [err.message],
      },
    ];
  }
}
