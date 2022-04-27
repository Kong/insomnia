import { spawn } from 'child_process';
import { promises } from 'fs';
import path from 'path';
const { platform } = process;
const isMac = () => platform === 'darwin';
const isLinux = () => platform === 'linux';
const isWindows = () => platform === 'win32';

/** see: https://github.com/vercel/pkg#targets */
const getTargets = () => {
  if (isMac()) {
    return 'node16-macos-x64';
  }

  if (isLinux()) {
    return 'node16-linux-x64';
  }

  if (isWindows()) {
    return 'node16-win-x64';
  }

  throw new Error(`[pkg-inso] Unsupported OS: ${platform}`);
};

const pkg = async () => {
  return new Promise<void>(resolve => {
    const cwd = path.join(__dirname, '../..');
    const args = [
      '.',
      '--targets',
      getTargets(),
      '--output',
      'binaries/inso',
    ];
    console.log('pkg', args.join(' '));
    const process = spawn('./node_modules/.bin/pkg', args, {
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
        console.log(`[pkg-inso] exited with code ${code}`);
        throw new Error('[pkg-inso] failed to package');
      }

      resolve();
    });
  });

};

const verifyFile = (basePath: string) => async (fileName: string) => {
  const filePath = path.join(basePath, fileName);
  try {
    const stats = await promises.stat(filePath);
    if (!stats) {
      throw new Error(`[pkg-inso-verify] failed to find file ${filePath}`);
    }
    if (stats.size === 0) {
      throw new Error(`[pkg-inso-verify] the file ${filePath} is unexpectedly empty`);
    }
  } catch (error: unknown) {
    throw error;
  }
};

const verifyPkg = async () => {
  const basePath = path.resolve('binaries');

  const files = await promises.readdir(basePath);
  if (files.length === 0) {
    throw new Error('[pkg-inso-verify] no executable binary found');
  }

  return Promise.all(files.map(verifyFile(basePath)));
};

pkg()
  .then(() => {
    verifyPkg()
      .then(() => {
        process.exit(0);
      })
      .catch(error => {
        console.error(error);
        process.exit(1);
      });
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
