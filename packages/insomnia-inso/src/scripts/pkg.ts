import { spawn } from 'child_process';
import path from 'path';

const prefixPkgInso = (msg: string) => `[pkg-inso] ${msg}`;

const { platform } = process;
const isMac = () => platform === 'darwin';
const isLinux = () => platform === 'linux';
const isWindows = () => platform === 'win32';

const getTargets = () => {
  if (isMac()) {
    return ['node12-macos-x64'];
  }

  if (isLinux()) {
    return ['node12-linux-x64'];
  }

  if (isWindows()) {
    return ['node12-win-x64'];
  }

  throw new Error(prefixPkgInso(`Unsupported OS: ${platform}`));
};

const pkg = async () => {
  return new Promise<void>(resolve => {
    const targets = getTargets();

    const rootDir = path.join(__dirname, '../..');

    const process = spawn('npm',
      [
        'run',
        'pkg',
        '--',
        '--targets',
        targets.join(','),
        '--output',
        'binaries/inso',
      ], {
        cwd: rootDir,
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
        console.log(prefixPkgInso(`exited with code ${code}`));
        throw new Error(prefixPkgInso('failed to package'));
      }

      resolve();
    });
  });

};

pkg()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
