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

    // We store insomnia files in the database and all other files in a folder named 'other' on disk
    // When we read a directory, we need to merge the two lists to provide the full list of files
    if (method === 'readdir') {
      let insomniaFiles = [];
      try {
        insomniaFiles = await insomniaFS.promises.readdir(filePath, ...args);
      } catch (err) {
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

    if (filePath.endsWith('.yaml')) {
      try {
        const result = await insomniaFS.promises[method]!(filePath, ...args);
        if (method === 'writeFile' && writeFileMap) {
          writeFileMap[filePath.split(path.win32.sep).join(path.posix.sep)] = args[0].toString();
        }
        return result;
      } catch (err) {
        const result = await defaultFS.promises[method]!(filePath, ...args);

        return result;
      }
    }

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
    // Because when writing files using insomniaFS, in some cases write operations that contain conflicting content may be skipped by insomniaFS. Therefore, we added the startCollectWriteAction and stopCollectWriteAction methods to collect all attempted writes to insomniaFS within a certain period of time.
    startCollectWriteAction: (oriWriteFileMap: WriteFileMap) => {
      writeFileMap = oriWriteFileMap;
    },
    stopCollectWriteAction: () => {
      writeFileMap = null;
    },
  };
}
