import { spawn } from 'child_process';
import mkdirp from 'mkdirp';
import path from 'path';

import { getVersion } from '../util';

const prefixPkgArtifacts = (msg: string) => `[pkg-inso-artifacts] ${msg}`;

const { platform } = process;
const isMac = () => platform === 'darwin';
const isLinux = () => platform === 'linux';
const isWindows = () => platform === 'win32';

const getTarArgs = () => {
  const version = getVersion();
  if (isMac()) {
    return ['-czf', `inso-macos-${version}.zip`];
  }

  if (isLinux()) {
    return ['-cJf', `inso-linux-${version}.tar.xz`];
  }

  if (isWindows()) {
    return ['-czf', `inso-windows-${version}.zip`];
  }

  throw new Error(prefixPkgArtifacts(`Unsupported OS: ${platform}`));
};

const artifacts = async () => {
  return new Promise<void>(resolve => {
    const cwd = path.join(__dirname, '../../artifacts');
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
        console.log(prefixPkgArtifacts(`exited with code ${code}`));
        throw new Error(prefixPkgArtifacts('failed to compress'));
      }

      resolve();
    });
  });
};

artifacts()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
