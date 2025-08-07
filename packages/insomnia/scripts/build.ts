import { cp, mkdir } from 'node:fs/promises';
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
