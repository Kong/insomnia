// @flow
import path from 'path';

const pathSep = path.sep === path.win32.sep ? '\\\\' : path.posix.sep;
const regExp = new RegExp(pathSep, 'g');

export function convertToPosix(filePath: string) {
  return filePath.replace(regExp, path.posix.sep);
}
