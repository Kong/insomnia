import { ProcessEnvOptions, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import { getVersion } from '../util';

const prefixPkgArtifacts = (msg: string) => `[pkg-inso-artifacts] ${msg}`;

const { platform } = process;
const isMac = () => platform === 'darwin';
const isLinux = () => platform === 'linux';
const isWindows = () => platform === 'win32';

const getArchiveName = () => {
  const version = getVersion();
  if (isMac()) {
    return `inso-macos-${version}.zip`;
  }

  if (isLinux()) {
    return `inso-linux-${version}.tar.xz`;
  }

  if (isWindows()) {
    return `inso-windows-${version}.zip`;
  }

  throw new Error(prefixPkgArtifacts(`Unsupported OS: ${platform}`));
};

const startProcess = (cwd: ProcessEnvOptions['cwd']) => {
  const name = getArchiveName();

  if (isMac()) {
    return spawn('ditto',
      [
        '-c',
        '-k',
        '../binaries/inso',
        name,
      ], {
        cwd,
        shell: true,
      });
  }

  if (isWindows() || isLinux()) {

    return spawn('tar',
      [
        '-C',
        '../binaries',
        isWindows() ? '-a -cf' : '-cJf',
        name,
        isWindows() ? 'inso.exe' : 'inso',
      ], {
        cwd,
        shell: true,
      });
  }

  throw new Error(prefixPkgArtifacts(`Unsupported OS: ${platform}`));
};

const artifacts = async () => {
  return new Promise<void>(resolve => {
    const cwd = path.join(__dirname, '../../artifacts');
    fs.mkdirSync(cwd, { recursive: true });

    const process = startProcess(cwd);

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
