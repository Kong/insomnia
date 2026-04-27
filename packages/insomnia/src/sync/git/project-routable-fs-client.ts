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
 * A pure disk FS client for isomorphic-git that routes by path prefix.
 *
 * - `defaultFS` handles everything by default (the repo working tree).
 * - `otherFS`   maps path prefixes to specialised clients (e.g. `.git` → on-disk git data).
 *
 * YAML files are written to disk only. The {@link RepoFileWatcher} is solely
 * responsible for syncing between disk and the NeDB database.
 *
 * `writeFileMap` can be enabled around pull/merge operations so the UI can
 * surface merge-conflict content for manual resolution.
 */
export function projectRoutableFSClient(defaultFS: git.PromiseFsClient, otherFS: Record<string, git.PromiseFsClient>) {
  let writeFileMap: WriteFileMap | null = null;

  const execMethod = async (method: Methods, filePath: string, ...args: any[]) => {
    filePath = path.normalize(filePath);

    // 1) Prefix routing: forward into any registered special FS (e.g. '.git')
    for (const prefix of Object.keys(otherFS)) {
      if (filePath.indexOf(path.normalize(prefix)) === 0) {
        return otherFS[prefix].promises[method]!(filePath, ...args);
      }
    }

    // 2) Default: delegate to the on-disk FS
    const result = await defaultFS.promises[method]!(filePath, ...args);

    // 3) Collect YAML writes for conflict UI when enabled
    if (method === 'writeFile' && filePath.endsWith('.yaml') && writeFileMap) {
      writeFileMap[filePath.split(path.win32.sep).join(path.posix.sep)] = args[0].toString();
    }

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
    // @TODO The only reason we keep this file is for these two methods and the fileMap.
    // We should consider a more elegant way to surface merge conflict content to the UI.
    startCollectWriteAction: (oriWriteFileMap: WriteFileMap) => {
      writeFileMap = oriWriteFileMap;
    },
    stopCollectWriteAction: () => {
      writeFileMap = null;
    },
  };
}
