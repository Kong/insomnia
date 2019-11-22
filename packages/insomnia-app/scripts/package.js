const packageJson = require('../package.json');
const electronBuilder = require('electron-builder');
const path = require('path');
const rimraf = require('rimraf');
const fs = require('fs');
const buildTask = require('./build');

const PLATFORM_MAP = {
  darwin: 'mac',
  linux: 'linux',
  win32: 'win',
};

// Start package if ran from CLI
if (require.main === module) {
  process.nextTick(async () => {
    try {
      await buildTask.start();
      await module.exports.start();
    } catch (err) {
      console.log('[package] ERROR:', err);
      process.exit(1);
    }
  });
}

module.exports.start = async function() {
  console.log('[package] Removing existing directories');

  if (process.env.KEEP_DIST_FOLDER !== 'yes') {
    await emptyDir('../dist/*');
  }

  console.log('[package] Packaging app');
  await pkg('../.electronbuilder');

  console.log('[package] Complete!');
};

async function pkg(relConfigPath) {
  const configPath = path.resolve(__dirname, relConfigPath);

  // Replace some things
  const rawConfig = fs
    .readFileSync(configPath, 'utf8')
    .replace('__APP_ID__', packageJson.app.appId)
    .replace('__ICON_URL__', packageJson.app.icon)
    .replace('__EXECUTABLE_NAME__', packageJson.app.executableName)
    .replace('__SYNOPSIS__', packageJson.app.synopsis);

  // console.log(`[package] Using electron-builder config\n${rawConfig}`);

  const config = JSON.parse(rawConfig);
  const targetPlatform = PLATFORM_MAP[process.platform];

  const target = process.env.BUILD_TARGETS
    ? process.env.BUILD_TARGETS.split(',')
    : config[targetPlatform].target;

  return electronBuilder.build({
    config,
    [targetPlatform]: target,
  });
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
