import { spawn } from 'child_process';
import path from 'path';

const prefixPkgInso = (msg: string) => `[pkg-inso] ${msg}`;

const getPlatform = () => process.platform;
const isMac = () => getPlatform() === 'darwin';
const isLinux = () => getPlatform() === 'linux';
const isWindows = () => getPlatform() === 'win32';

const getTargets = () => {
  if (isMac()) {
    return ['node12-macos-x64'];
  } else if (isLinux()) {
    return ['node12-linux-x64'];
  } else if (isWindows()) {
    return ['node12-win-x64'];
  } else {
    return [];
  }
};

const pkg = async () => {
  return new Promise<void>((resolve, reject) => {
    const targets = getTargets();

    if (targets.length === 0) {
      reject(new Error(prefixPkgInso(`Unsupported OS ${getPlatform()}`)));
    }

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
      if (code === 0) {
        resolve();
      } else {
        console.log(prefixPkgInso(`exited with code ${code}`));
        reject(new Error(prefixPkgInso('failed to package')));
      }
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
