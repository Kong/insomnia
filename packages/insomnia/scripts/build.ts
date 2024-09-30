import childProcess from 'child_process';
import { cp, mkdir, rm } from 'fs/promises';
import path from 'path';
import * as vite from 'vite';

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

  console.log(
    `[build] npm: ${childProcess.spawnSync('npm', ['--version']).stdout}`.trim()
  );
  console.log(
    `[build] node: ${childProcess.spawnSync('node', ['--version']).stdout}`.trim()
  );

  if (process.version.indexOf('v20.') !== 0) {
    console.log('[build] Node 20.x.x is required to build');
    process.exit(1);
  }

  const buildFolder = path.join('../build');

  // Remove folders first
  console.log('[build] Removing existing directories');
  await rm(path.resolve(__dirname, buildFolder), { recursive: true, force: true });

  console.log('[build] Building main.min.js and preload');
  await buildMainAndPreload({
    mode: 'production',
  });

  console.log('[build] Building renderer');

  await vite.build({
    configFile: path.join(__dirname, '..', 'vite.config.ts'),
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

  console.log('[build] Complete!');
};
