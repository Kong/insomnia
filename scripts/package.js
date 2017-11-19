const electronBuilder = require('electron-builder');
const config = require('../.electronbuilder');
const path = require('path');
const rimraf = require('rimraf');

const PLATFORM_MAP = {
  darwin: 'mac',
  linux: 'linux',
  win32: 'win'
};

async function run () {
  console.log('[package] Removing existing directories');
  await removeDir('../dist');

  console.log('[package] Packaging app');
  await build(config);

  console.log('[package] Complete!');
}

async function build (config) {
  try {
    const targetPlatform = PLATFORM_MAP[process.platform];
    const packager = new electronBuilder.Packager({
      config,
      [targetPlatform]: config[targetPlatform].target
    });
    return packager.build();
  } catch
    (err) {
    console.log('[package] Failed: ' + err.stack);
    throw err;
  }
}

async function removeDir (relPath) {
  return new Promise((resolve, reject) => {
    const dir = path.resolve(__dirname, relPath);
    rimraf(dir, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

run();
