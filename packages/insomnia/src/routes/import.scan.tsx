import path from 'node:path';

import { type ActionFunctionArgs, href } from 'react-router';

import type { ScanResult } from '~/common/import';
import { fetchImportContentFromURI, getFilesFromPostmanExportedDataDump, scanResources } from '~/common/import';
import type { ImportEntry } from '~/main/importers/entities';
import { SegmentEvent } from '~/ui/analytics';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

type SourceType = 'file' | 'uri' | 'clipboard';

export const scanImportResources = async (data: {
  source: SourceType;
  uri?: string;
  filePaths?: string | string[];
  postmanArchiveFile?: string | null;
}): Promise<ScanResult[]> => {
  const { source, postmanArchiveFile } = data;

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

    // When a postman environment is uncompressed from a postman bulk export zip file, there's not identifier for us to identify it as a postman environment.
    // Use the archive.json file to check and set a identifier for it
    let postmanArchiveJsonData: { environment?: Record<string, boolean> } | null = null;
    if (postmanArchiveFile) {
      try {
        const postmanArchiveFileContent = await window.main.insecureReadFile({
          path: postmanArchiveFile,
        });
        postmanArchiveJsonData = JSON.parse(postmanArchiveFileContent);
      } catch (err) {
        return [
          {
            oriFileName: postmanArchiveFile,
            errors: ['Failed to parse archive.json file'],
          },
        ];
      }
    }

    for (const filePath of nonZipFilePaths) {
      const uri = `file://${filePath}`;
      let contentStr = await fetchImportContentFromURI({ uri });

      if (postmanArchiveJsonData) {
        try {
          const jsonData = JSON.parse(contentStr);
          if (postmanArchiveJsonData.environment?.[jsonData.id]) {
            jsonData._postman_variable_scope = 'environment';
            contentStr = JSON.stringify(jsonData);
          }
        } catch (error) {
          // It's not a valid JSON, shouldn't be a postman environment
        }
      }

      contentList.push({
        contentStr,
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

  const result = await scanResources(contentList);

  return result;
};

interface ImportScanInputData {
  source: SourceType;
  uri?: string;
  filePaths?: string | string[];
  postmanArchiveFile?: string | null;
}

export async function clientAction({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const data = Object.fromEntries(formData.entries()) as unknown as ImportScanInputData;

    return await scanImportResources(data);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return [
      {
        errors: [errorMessage],
      },
    ];
  }
}

export const useScanResourcesFetcher = createFetcherSubmitHook(
  submit => (data: FormData | HTMLFormElement) => {
    return submit(data, {
      action: href('/import/scan'),
      method: 'POST',
    });
  },
  clientAction,
);
