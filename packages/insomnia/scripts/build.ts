import { spawn } from 'node:child_process';
import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import buildMainAndPreload from '../esbuild.main';

// Start build if ran from CLI
if (require.main === module) {
  process.nextTick(async () => {
    try {
      await module.exports.start();
    } catch (err) {
      console.log('[build] ERROR:', err);
      process.exit(1);
    }
  });
}

export const start = async () => {
  console.log('[build] Starting build');

  console.log(`[build] node: ${process.version}`.trim());

  if (process.version.indexOf('v22.') !== 0) {
    console.log('[build] Node 22.x.x is required to build');
    process.exit(1);
  }

  const buildFolder = path.join('../build');

  // Remove folders first
  console.log('[build] Removing existing directories');
  await rm(path.resolve(__dirname, buildFolder), { recursive: true, force: true });

  console.log('[build] Building renderer');

  function buildRenderer() {
    return new Promise((resolve, reject) => {
      const buildProcess = spawn('react-router', ['build'], { shell: true });
      buildProcess.stdout.on('data', data => {
        console.log(`[build] ${data}`);
      });
      buildProcess.stderr.on('data', data => {
        console.error(`[build] ${data}`);
      });
      buildProcess.on('close', code => {
        if (code !== 0) {
          reject(new Error(`Build process exited with code ${code}`));
        } else {
          resolve(true);
        }
      });
    });
  }

  await buildRenderer();

  console.log('[build] Building main.min.js and preload');
  await buildMainAndPreload({
    mode: 'production',
  });

  // Copy necessary files
  console.log('[build] Copying files');
  const copyFiles = async (relSource: string, relDest: string) => {
    const src = path.resolve(__dirname, relSource);
    const dest = path.resolve(__dirname, relDest);
    await mkdir(path.dirname(dest), { recursive: true });
    await cp(src, dest, { recursive: true, verbatimSymlinks: true });
  };
  await copyFiles('../bin', buildFolder);
  await copyFiles('../src/static', path.join(buildFolder, 'static'));
  await copyFiles('../src/icons', buildFolder);
  await copyFiles('../src/main/lint-process.mjs', path.join(buildFolder, 'main/lint-process.mjs'));
  await copyFiles('../src/hidden-window.html', path.join(buildFolder, 'hidden-window.html'));

  console.log('[build] Complete!');
};
