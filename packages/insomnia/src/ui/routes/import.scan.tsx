import path from 'node:path';

import type { ActionFunctionArgs } from 'react-router';

import type { ScanResult } from '../../common/import';
import { fetchImportContentFromURI, getFilesFromPostmanExportedDataDump, scanResources } from '../../common/import';
import type { ImportEntry } from '../../utils/importers/entities';
import { invariant } from '../../utils/invariant';
import { SegmentEvent } from '../analytics';

type SourceType = 'file' | 'uri' | 'clipboard';

export const scanImportResources = async (data: {
  source: SourceType;
  uri?: string;
  filePaths?: string | string[];
  postmanArchiveFile?: string | null;
}): Promise<ScanResult[]> => {
  const { source } = data;

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
    const { uri } = data;
    invariant(typeof uri === 'string' && uri.length, 'URI is required');

    contentList.push({
      contentStr: await fetchImportContentFromURI({ uri }),
      oriFileName: uri,
    });
  } else if (source === 'file') {
    let filePaths: string[];
    try {
      filePaths = typeof data.filePaths === 'string' ? JSON.parse(data.filePaths) : data.filePaths;
      if (!Array.isArray(filePaths)) {
        throw new Error('filePaths is not an array');
      }
      filePaths = filePaths.filter(filePath => typeof filePath === 'string' && filePath);
      if (filePaths.length === 0) {
        throw new Error('filePaths is empty');
      }
    } catch {
      throw new Error('File is required');
    }

    const zipFilePaths = filePaths.filter(filePath => path.extname(filePath) === '.zip');
    const nonZipFilePaths = filePaths.filter(filePath => path.extname(filePath) !== '.zip');

    // zip file is for postman data dump
    for (const zipFilePath of zipFilePaths) {
      const postmanDataDumpRawData = await getFilesFromPostmanExportedDataDump(zipFilePath);

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
    throw new Error('No content to import');
  }

  const { postmanArchiveFile } = data;
  const result = await scanResources(contentList, postmanArchiveFile);

  return result;
};

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();

    return await scanImportResources({
      source: formData.get('importFrom') as SourceType,
      uri: formData.get('uri') as string | undefined,
      filePaths: formData.get('filePaths') as string | string[] | undefined,
      postmanArchiveFile: formData.get('postmanArchiveFile') as string | null,
    });
  } catch (err) {
    return [
      {
        errors: [err.message],
      },
    ];
  }
}
