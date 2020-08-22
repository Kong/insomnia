const { appConfig, electronBuilderConfig } = require('../config');
const electronBuilder = require('electron-builder');
const path = require('path');
const rimraf = require('rimraf');
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
      await buildTask.start(false);
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
    const appId = appConfig().appId;
    await emptyDir(path.join('..', 'dist', appId, '*'));
  }

  console.log('[package] Packaging app');
  await pkg(electronBuilderConfig());

  console.log('[package] Complete!');
};

async function pkg(electronBuilderConfig) {
  const app = appConfig();

  // Replace some things
  const rawConfig = JSON.stringify(electronBuilderConfig, null, 2)
    .replace(/__APP_ID__/g, app.appId)
    .replace(/__BINARY_PREFIX__/g, app.binaryPrefix)
    .replace(/__EXECUTABLE_NAME__/g, app.executableName)
    .replace(/__GITHUB_OWNER__/g, app.githubOrg)
    .replace(/__GITHUB_REPO__/g, app.githubRepo)
    .replace(/__ICON_URL__/g, app.icon)
    .replace(/__SYNOPSIS__/g, app.synopsis);

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
