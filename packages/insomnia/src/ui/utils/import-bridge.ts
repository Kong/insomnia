// Renderer-side bridge over the Electron `window.main` IPC for the import
// helpers in common/import.ts. It is loaded only from the renderer branch of
// that module's `__IS_RENDERER__` forks, so it never enters node/main builds
// and common/import.ts does not need to name `window`. Each export mirrors the
// signature of its node-side counterpart so the fork call sites stay symmetric.

export const insecureReadFile = (filePath: string): Promise<string> =>
  window.main.insecureReadFile({ path: filePath });

export const extractJsonFileFromPostmanDataDumpArchive = (filePath: string) =>
  window.main.extractJsonFileFromPostmanDataDumpArchive(filePath);

export const convert: typeof window.main.parseImport = (...args) => window.main.parseImport(...args);
