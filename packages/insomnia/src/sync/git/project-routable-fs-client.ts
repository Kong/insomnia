import path from 'node:path';

import type * as git from 'isomorphic-git';

type Methods =
  | 'readFile'
  | 'writeFile'
  | 'unlink'
  | 'readdir'
  | 'mkdir'
  | 'rmdir'
  | 'stat'
  | 'lstat'
  | 'readlink'
  | 'symlink';

export type WriteFileMap = Record<string, string>;

/**
 * An isometric-git FS client that can route to various client depending on what the filePath is.
 *
 * @param defaultFS – default client
 * @param otherFS – map of path prefixes to clients
 * @returns {{promises: *}}
 */
export function projectRoutableFSClient(
  defaultFS: git.PromiseFsClient,
  insomniaFS: git.PromiseFsClient,
  otherFS: Record<string, git.PromiseFsClient>,
) {
  let writeFileMap: WriteFileMap | null = null;
  const execMethod = async (method: Methods, filePath: string, ...args: any[]) => {
    filePath = path.normalize(filePath);

    // 1) Prefix routing: forward into any registered special FS (e.g. '.git')
    for (const prefix of Object.keys(otherFS)) {
      if (filePath.indexOf(path.normalize(prefix)) === 0) {
        // TODO: remove non-null assertion

        return otherFS[prefix].promises[method]!(filePath, ...args);
      }
    }

    // Uncomment this to debug operations
    // console.log('[routablefs] Executing', method, filePath, { args });
    // Fallback to default if no prefix matched
    // TODO: remove non-null assertion

    // 2) Directory reads merge: DB-backed list (insomniaFS) + disk list (defaultFS)
    // This exposes a unified directory view combining virtual YAML files and on-disk files.
    if (method === 'readdir') {
      let insomniaFiles = [];
      try {
        insomniaFiles = await insomniaFS.promises.readdir(filePath, ...args);
      } catch {
        // console.log('[routablefs] Failed to execute', method, filePath, { args }, err);
      }

      // These are the default files on disk
      let defaultFiles = [];
      try {
        defaultFiles = await defaultFS.promises.readdir(filePath, ...args);
      } catch (err) {
        if (insomniaFiles.length === 0) {
          throw err;
        }
      }

      return [...new Set([...insomniaFiles, ...defaultFiles])];
    }

    // 3) YAML files: dual-sync between disk (defaultFS) and DB (insomniaFS).
    //
    // - writeFile: write to disk first, then import into DB. Suppressed paths
    //   (those being written by the watcher itself) skip the DB re-import to
    //   prevent write loops. Collect content in writeFileMap for conflict UI.
    // - readFile / stat / lstat: prefer disk; fall back to DB-export.
    // - unlink: remove from both disk and DB.
    if (filePath.endsWith('.yaml')) {
      if (method === 'writeFile') {
        // Write to disk first so the file is real and Git-accessible.
        await defaultFS.promises.writeFile!(filePath, ...args);
        // Then import into DB (insomniaFS.writeFile triggers tryImportV5Data).
        try {
          await insomniaFS.promises.writeFile!(filePath, ...args);
        } catch {
          // Non-fatal: disk write succeeded; DB import failure is logged inside insomniaFS.
        }
        if (writeFileMap) {
          writeFileMap[filePath.split(path.win32.sep).join(path.posix.sep)] = args[0].toString();
        }
        return;
      }

      if (method === 'unlink') {
        // Best-effort removal from both stores.
        await Promise.allSettled([defaultFS.promises.unlink!(filePath), insomniaFS.promises.unlink!(filePath)]);
        return;
      }

      if (method === 'readFile' || method === 'stat' || method === 'lstat') {
        // Prefer the real on-disk file; fall back to DB-generated content.
        try {
          return await defaultFS.promises[method]!(filePath, ...args);
        } catch {
          return await insomniaFS.promises[method]!(filePath, ...args);
        }
      }

      // readlink and symlink: delegate to disk.
      try {
        return await defaultFS.promises[method]!(filePath, ...args);
      } catch {
        return await insomniaFS.promises[method]!(filePath, ...args);
      }
    }

    // 4) Fallback: everything else goes to the default on-disk FS (e.g. 'other').
    const result = await defaultFS.promises[method]!(filePath, ...args);

    // Uncomment this to debug operations
    // console.log('[routablefs] Executing', method, filePath, { args }, { result });
    return result;
  };

  // @ts-expect-error -- TSCONVERSION declare and initialize together to avoid an error
  const methods: git.CallbackFsClient = {};
  methods.readFile = execMethod.bind(methods, 'readFile');
  methods.writeFile = execMethod.bind(methods, 'writeFile');
  methods.unlink = execMethod.bind(methods, 'unlink');
  methods.readdir = execMethod.bind(methods, 'readdir');
  methods.mkdir = execMethod.bind(methods, 'mkdir');
  methods.rmdir = execMethod.bind(methods, 'rmdir');
  methods.stat = execMethod.bind(methods, 'stat');
  methods.lstat = execMethod.bind(methods, 'lstat');
  methods.readlink = execMethod.bind(methods, 'readlink');
  methods.symlink = execMethod.bind(methods, 'symlink');
  return {
    promises: methods,
    // Collect attempted DB-backed YAML writes during operations like pull/merge so
    // the UI can surface suggested merge results even if actual writes were skipped.
    startCollectWriteAction: (oriWriteFileMap: WriteFileMap) => {
      writeFileMap = oriWriteFileMap;
    },
    stopCollectWriteAction: () => {
      writeFileMap = null;
    },
  };
}
