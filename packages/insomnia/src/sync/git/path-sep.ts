import path from 'node:path';

const win32SepRegex = /\\/g;
const posixSepRegex = /\//g;

export function convertToPosixSep(filePath: string) {
  return filePath.replaceAll(win32SepRegex, path.posix.sep);
}

export function convertToOsSep(filePath: string) {
  // is windows, so convert posix sep to windows sep
  if (path.sep === path.win32.sep) {
    return filePath.replaceAll(posixSepRegex, path.win32.sep);
  }

  // is posix, so convert win32 sep to posix sep
  return filePath.replaceAll(win32SepRegex, path.posix.sep);
}
