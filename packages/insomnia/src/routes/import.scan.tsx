import { type ActionFunctionArgs, href } from 'react-router';

import type { ImportSourceType, ScanResult } from '~/common/import';
import {
  fetchImportContentFromURI,
  getFilesFromPostmanExportedDataDump,
  IMPORT_SOURCE_TYPES,
  mcpUrlToInsomniaV5Yaml,
  scanResources,
} from '~/common/import';
import type { ImportEntry } from '~/main/importers/entities';
import { SegmentEvent } from '~/ui/analytics';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

export const scanImportResources = async (data: {
  source: ImportSourceType;
  uri?: string;
  curl?: string;
  mcp?: string;
  filePaths?: string | string[];
  postmanArchiveFile?: string | null;
}): Promise<ScanResult[]> => {
  const { source, postmanArchiveFile } = data;
  const isZipFilePath = (filePath: string) => filePath.toLowerCase().endsWith('.zip');

  invariant(typeof source === 'string', 'Source is required.');
  invariant(IMPORT_SOURCE_TYPES.includes(source), 'Unsupported import type');

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
  } else if (source === 'curl') {
    const { curl } = data;
    invariant(typeof curl === 'string' && curl.length, 'cURL command is required');
    contentList.push({
      contentStr: curl,
    });
  } else if (source === 'mcp') {
    const { mcp } = data;
    invariant(typeof mcp === 'string' && mcp.length, 'MCP server URL is required');
    const importYaml = mcpUrlToInsomniaV5Yaml(mcp);
    invariant(importYaml, 'Failed to convert MCP URL to Insomnia v5 YAML');
    contentList.push({
      contentStr: importYaml,
      oriFileName: 'mcp',
    });
  } else if (source === 'file') {
    let filePaths: string[];
    try {
      filePaths = typeof data.filePaths === 'string' ? JSON.parse(data.filePaths) : data.filePaths;
      if (!Array.isArray(filePaths)) {
        throw new TypeError('filePaths is not an array');
      }
      filePaths = filePaths.filter(filePath => typeof filePath === 'string' && filePath);
      if (filePaths.length === 0) {
        throw new Error('filePaths is empty');
      }
    } catch {
      throw new Error('File is required');
    }

    const zipFilePaths = filePaths.filter(isZipFilePath);
    const nonZipFilePaths = filePaths.filter(filePath => !isZipFilePath(filePath));

    // zip file is for postman data dump
    for (const zipFilePath of zipFilePaths) {
      const postmanDataDumpRawData = await getFilesFromPostmanExportedDataDump(zipFilePath);
      const zipBaseName = window.path.basename(zipFilePath);

      function trans({ contentStr, oriFileName }: ImportEntry): ImportEntry {
        return {
          contentStr,
          oriFileName: `${oriFileName} in ${zipBaseName}`,
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
      } catch {
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
        } catch {
          // It's not a valid JSON, shouldn't be a postman environment
        }
      }

      contentList.push({
        contentStr,
        oriFileName: window.path.basename(filePath),
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
  source: ImportSourceType;
  uri?: string;
  curl?: string;
  mcp?: string;
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
