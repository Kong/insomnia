import { promises } from 'fs';
import { join, resolve } from 'path';

const prefixPkgVerify = (msg: string) => `[pkg-inso-verify] ${msg}`;

const { readdir, stat } = promises;

const verifyFile = (basePath: string) => async (fileName: string) => {
  const filePath = join(basePath, fileName);
  try {
    const stats = await stat(filePath);
    if (!stats) {
      throw new Error(prefixPkgVerify(`failed to find file ${filePath}`));
    }
    if (stats.size === 0) {
      throw new Error(prefixPkgVerify(`the file ${filePath} is unexpectedly empty`));
    }
  } catch (error: unknown) {
    throw error;
  }
};

const verifyPkg = async () => {
  const basePath = resolve('binaries');

  const files = await readdir(basePath);
  if (files.length === 0) {
    throw new Error(prefixPkgVerify('no executable binary found'));
  }

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
