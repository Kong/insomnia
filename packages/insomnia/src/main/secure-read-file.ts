import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import electron from 'electron';
import { services } from 'insomnia-data';

import { invariant } from '~/common/utils/invariant';

import { SECURITY_SETTINGS_PATH_LABEL } from '../common/misc';

export const isPathAllowed = (filePath: string, userAllowList: string[]) => {
  const allowList = getSecuredFolderAllowList(userAllowList);
  const securedPath = securePath(filePath);
  const isAllowed = allowList.some(f => {
    const resolvedRoot = path.resolve(f);
    return resolvedRoot !== '' && (securedPath === resolvedRoot || securedPath.startsWith(resolvedRoot + path.sep));
  });
  return { isAllowed, securedPath };
};
const securePath = (filePath: string) => path.resolve(decodeURIComponent(filePath));
const getSecuredFolderAllowList = (userAllowList: string[]) => {
  const userdataDirectory = process.env.INSOMNIA_DATA_PATH || electron.app.getPath('userData');
  // we use tmpdir for buildMultipart
  // we put the db in userData
  // the user can also specifiy other folders
  return [os.tmpdir(), userdataDirectory, ...userAllowList];
};
// NeDB stores every model as `insomnia.<Model>.db` directly inside the userData directory
// (see database-nedb.ts), so the templating/plugin/script file-read surface must never be
// allowed to reach those files even though that directory is otherwise an allowed root.
const isReservedDatabaseFile = (filePath: string) => /^insomnia\..+\.db.*$/i.test(path.basename(filePath));
const cannotAccessFileError = (securedPath: string) =>
  `Insomnia cannot access the file "${securedPath}". You must specify which directories Insomnia can access in ${SECURITY_SETTINGS_PATH_LABEL}`;
const resolveRealPath = async (filePath: string) => fs.promises.realpath(filePath).catch(() => filePath);
// For reading files specified by plugins, environment variables, and scripts which could come from an imported collection
export const secureReadFile = async (filePath: string): Promise<string> => {
  const settings = await services.settings.getOrCreate();
  const { isAllowed, securedPath } = isPathAllowed(filePath, settings.dataFolders);
  invariant(isAllowed && !isReservedDatabaseFile(securedPath), cannotAccessFileError(securedPath));

  // Re-check against the resolved real path (of both the target file and the allowed roots,
  // since e.g. macOS symlinks /var to /private/var) so a symlink can't be used to point an
  // allowed directory at a reserved database file or a location outside the allowlist.
  const realPath = await resolveRealPath(securedPath);
  const realAllowList = await Promise.all(getSecuredFolderAllowList(settings.dataFolders).map(resolveRealPath));
  const { isAllowed: isRealPathAllowed } = isPathAllowed(realPath, realAllowList);
  invariant(isRealPathAllowed && !isReservedDatabaseFile(realPath), cannotAccessFileError(securedPath));

  return fs.promises.readFile(realPath, { encoding: 'utf8' });
};
// For reading files selected by the user via a file dialog
export const insecureReadFile = async (filePath: string): Promise<string> => {
  return fs.promises.readFile(securePath(filePath), { encoding: 'utf8' });
};
// One off - For reading files used for the request runner
export const insecureReadFileWithEncoding = async (
  filePath: string,
  options?: Parameters<typeof fs.promises.readFile>[1],
): Promise<string | Buffer> => {
  return fs.promises.readFile(securePath(filePath), options);
};
