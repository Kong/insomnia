import type { ConvertResult } from '../../main/importers/convert';
import type { ImportEntry } from '../../main/importers/entities';

// Renderer-side import helpers: delegate to the Electron `window.main` IPC so the
// heavy node-only work (file system access, archive extraction, importer modules)
// stays in the main process. Mirrors import-adapter.node.ts.

export const insecureReadFile = (filePath: string): Promise<string> => window.main.insecureReadFile({ path: filePath });

export const extractJsonFileFromPostmanDataDumpArchive = (filePath: string): Promise<any> =>
  window.main.extractJsonFileFromPostmanDataDumpArchive(filePath);

export const convert = async (importEntry: ImportEntry, options?: { importerId?: string }): Promise<ConvertResult> =>
  (await window.main.parseImport(importEntry, options)) as unknown as ConvertResult;
