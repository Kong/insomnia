import type { ConvertResult } from '../../main/importers/convert';
import type { ImportEntry } from '../../main/importers/entities';

// Node-side import helpers: call the main-process handlers directly. Imports are
// deferred so this module stays cheap to load (e.g. in the inso CLI and tests)
// and only pulls in the importer/file-system code when actually used. Mirrors
// import-adapter.renderer.ts.

export const insecureReadFile = async (filePath: string): Promise<string> => {
  const { insecureReadFile } = await import('../../main/secure-read-file');
  return insecureReadFile(filePath);
};

export const extractJsonFileFromPostmanDataDumpArchive = async (filePath: string): Promise<any> => {
  const extractPostmanDataDumpHandler = (await import('../../main/ipc/extract-postman-data-dump')).default;
  return extractPostmanDataDumpHandler(null, filePath);
};

export const convert = async (importEntry: ImportEntry, options?: { importerId?: string }): Promise<ConvertResult> => {
  const { convert } = await import('../../main/importers/convert');
  return (await convert(importEntry, options)) as unknown as ConvertResult;
};
