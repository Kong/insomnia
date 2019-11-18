// @flow
import path from 'path';

/**
 * An isometric-git FS plugin that can route to various plugins depending on
 * what the filePath is.
 *
 * @param defaultFS – default plugin
 * @param otherFS – map of path prefixes to plugins
 * @returns {{promises: *}}
 */
export function routableFSPlugin(defaultFS: Object, otherFS: { [string]: Object }) {
  const execMethod = async (method: string, filePath: string, ...args: Array<any>) => {
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

  const methods = {};

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
