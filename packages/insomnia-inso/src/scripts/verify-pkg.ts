import { promises } from 'fs';
import { basename, join, resolve } from 'path';
import { difference, map } from 'ramda';

const { readdir, stat } = promises;

const fail = (message: string) => {
  throw new Error(`[inso-pkg]: ${message}`);
};

const verifyFile = (basePath: string) => async (fileName: string) => {
  const filePath = join(basePath, fileName);
  try {
    const stats = await stat(filePath);
    if (!stats) {
      fail(`failed to find file ${filePath}`);
    }
    if (stats.size === 0) {
      fail(`the file ${filePath} is unexpectedly empty`);
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      fail(error.message);
    }
    fail(`unexpected error: ${error}`);
  }

};

/** this list of binary artifiacts that we intended to create */
const desiredNames = [
  'insomnia-inso-alpine', // needed for CI use-cases
  'insomnia-inso-linux',
  'insomnia-inso-win.exe',
  'insomnia-inso-macos', // OSX binary (not M1-specific)
  // 'insomnia-inso-macos-arm64', // would be nice to have Apple M1 support here (`node12-mac-arm64`). see: https://github.com/vercel/pkg/issues/1023
];

const verifyAllFilesArePresent = (filePaths: string[]) => {
  const actualNames = map(basename, filePaths);

  const missingFiles = difference(desiredNames, actualNames);
  if (missingFiles.length > 0) {
    const singular = missingFiles.length === 1;
    fail(`missing ${singular ? 'a binary' : 'binaries'} for the expected file${singular ? '' : 's'}: ${missingFiles.join(', ')}`);
  }

  const extraFiles = difference(actualNames, desiredNames);
  if (extraFiles.length === 1) {
    const singular = extraFiles.length === 1;
    fail(`${singular ? 'an ' : ''}extra (and unexpected) ${singular ? 'binary was' : 'binaries were'} found: ${extraFiles.join(', ')}`);
  }
};

const verifyPkg = async () => {
  const basePath = resolve('binaries');

  const files = await readdir(basePath);
  if (files.length === 0) {
    fail('executable files found');
  }

  verifyAllFilesArePresent(files);

  return Promise.all(files.map(verifyFile(basePath)));
};

verifyPkg()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
