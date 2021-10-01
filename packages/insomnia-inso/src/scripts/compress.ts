import { spawn } from 'child_process';
import mkdirp from 'mkdirp';
import path from 'path';

import { getVersion } from '../util';

const prefixPkgCompress = (msg: string) => `[pkg-inso-compress] ${msg}`;

const { platform } = process;
const isMac = () => platform === 'darwin';
const isLinux = () => platform === 'linux';
const isWindows = () => platform === 'win32';

/** see: https://github.com/vercel/pkg#targets */
const getTarArgs = () => {
  const version = getVersion();
  if (isMac()) {
    return ['-zcf', `inso-macos-${version}.tar`];
  }

  if (isLinux()) {
    return ['-zxf', `inso-linux-${version}.tar.xz`];
  }

  if (isWindows()) {
    return ['-zcf', `inso-windows-${version}.zip`];
  }

  throw new Error(prefixPkgCompress(`Unsupported OS: ${platform}`));
};

const compress = async () => {
  return new Promise<void>(resolve => {
    const cwd = path.join(__dirname, '../../compressed');
    mkdirp.sync(cwd);

    const tarName = isWindows() ? 'tar.exe' : 'tar';
    const process = spawn(tarName,
      [
        '-C',
        '../binaries',
        ...getTarArgs(),
        '.',
      ], {
        cwd,
        shell: true,
      });

    process.stdout.on('data', data => {
      console.log(data.toString());
    });

    process.stderr.on('data', data => {
      console.log(data.toString());
    });

    process.on('exit', code => {
      if (code !== 0) {
        console.log(prefixPkgCompress(`exited with code ${code}`));
        throw new Error(prefixPkgCompress('failed to compress'));
      }

      resolve();
    });
  });
};

compress()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
