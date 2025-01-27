// This file is responsible for compressing the binaries for each architecture
import fs from 'node:fs/promises';
import process from 'node:process';

import { ProcessEnvOptions, spawn } from 'child_process';
import path from 'path';

import packageJson from '../../package.json';

const { platform } = process;

const spawnCompressProcess = (cwd: ProcessEnvOptions['cwd']) => {
  const version = process.env.VERSION || packageJson.version;

  if (platform === 'darwin') {
    return spawn('ditto', [
      '-c',
      '-k',
      '../binaries/inso',
      `inso-macos-${version}.zip`,
    ], { cwd });
  }

  if (platform === 'win32' || platform === 'linux') {
    return spawn('tar', [
      '-C',
      '../binaries',
      platform === 'win32' ? '-a -cf' : '-cJf',
      platform === 'win32'
        ? `inso-windows-${version}.zip`
        : `inso-linux-${process.arch}-${version}.tar.xz`,
      platform === 'win32' ? 'inso.exe' : 'inso',
    ], { cwd, shell: platform === 'win32' });
  }

  throw new Error(`[pkg-inso-artifacts] Unsupported OS: ${platform}`);
};

const artifacts = async () => {
  // ensure packages/insomnia-inso/artifacts exists
  const artifactsDir = path.join(__dirname, '../../artifacts');
  await fs.mkdir(artifactsDir, { recursive: true });
  return new Promise<void>(resolve => {
    const childProcess = spawnCompressProcess(artifactsDir);
    childProcess.stdout.on('data', data => {
      console.log(data.toString());
    });
    childProcess.stderr.on('data', data => {
      console.log(data.toString());
    });
    childProcess.on('exit', code => {
      if (code !== 0) {
        console.log(`[pkg-inso-artifacts] exited with code ${code}`);
        throw new Error('[pkg-inso-artifacts] failed to compress');
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
