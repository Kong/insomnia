const electronBuilder = require('electron-builder');
const path = require('path');
const rimraf = require('rimraf');
const fs = require('fs');
const buildTask = require('./build');

const PLATFORM_MAP = {
  darwin: 'mac',
  linux: 'linux',
  win32: 'win'
};

// Start package if ran from CLI
if (require.main === module) {
  process.nextTick(async () => {
    try {
      await buildTask.start();
      await module.exports.start();
    } catch (err) {
      console.warn('ERROR: ', err.stack);
    }
  });
}

module.exports.start = async function() {
  console.log('[package] Removing existing directories');
  await emptyDir('../dist/*');

  console.log('[package] Packaging app');
  await pkg('../.electronbuilder');

  console.log('[package] Complete!');
};

async function pkg(relConfigPath) {
  try {
    const configPath = path.resolve(__dirname, relConfigPath);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const targetPlatform = PLATFORM_MAP[process.platform];
    const packager = new electronBuilder.Packager({
      config,
      cscLink: process.env.CSC_LINK,
      cscKeyPassword: process.env.CSC_KEY_PASSWORD,
      [targetPlatform]: config[targetPlatform].target
    });
    return packager.build();
  } catch (err) {
    console.log('[package] Failed: ' + err.stack);
    throw err;
  }
}

async function emptyDir(relPath) {
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
