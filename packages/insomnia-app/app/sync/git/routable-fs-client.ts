import * as git from 'isomorphic-git';
import path from 'path';

/**
 * An isometric-git FS client that can route to various client depending on what the filePath is.
 *
 * @param defaultFS – default client
 * @param otherFS – map of path prefixes to clients
 * @returns {{promises: *}}
 */
export function routableFSClient(
  defaultFS: git.PromiseFsClient,
  otherFS: Record<string, git.PromiseFsClient>,
) {
  const execMethod = async (method: string, filePath: string, ...args: any[]) => {
    filePath = path.normalize(filePath);

    for (const prefix of Object.keys(otherFS)) {
      if (filePath.indexOf(path.normalize(prefix)) === 0) {
        return otherFS[prefix].promises[method](filePath, ...args);
      }
    }

    // Uncomment this to debug operations
    // console.log('[routablefs] Executing', method, filePath, { args });
    // Fallback to default if no prefix matched
    const result = await defaultFS.promises[method](filePath, ...args);
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
  };
}
