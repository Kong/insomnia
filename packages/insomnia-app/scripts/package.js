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
    const {
      GITHUB_REF,
      TRAVIS_TAG,
      FORCE_PACKAGE,

      // Bintray env vars for publishing
      BT_USER,
      BT_TOKEN,

      // Bintray env vars for consuming (auto-updater)
      BT_UPDATES_USER,
      BT_UPDATES_TOKEN,
    } = process.env;

    // First check if we need to publish (uses Git tags)
    const gitRefStr = GITHUB_REF || TRAVIS_TAG;
    const skipPublish = !gitRefStr || !gitRefStr.match(/v\d+\.\d+\.\d+(-(beta|alpha)\.\d+)?$/);
    if (FORCE_PACKAGE !== 'true' && skipPublish) {
      console.log(`[package] Not packaging for ref=${gitRefStr}`);
      process.exit(0);
    }

    // Error out if no Bintray credentials for auto-updates
    if (!BT_USER || !BT_TOKEN) {
      console.log(
        '[package] BT_USER and BT_TOKEN environment variables must be set' +
          'in order to publish to Bintray!',
      );
      process.exit(1);
    }

    // Error out if no Bintray credentials for auto-updates
    if (!BT_UPDATES_USER || !BT_UPDATES_TOKEN) {
      console.log(
        '[package] BT_UPDATES_USER and BT_UPDATES_TOKEN environment variables ' +
          'must be set for auto-updater to authenticate with Bintray!',
      );
      process.exit(1);
    }

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
    .replace('__BT_USER__', process.env.BT_USER)
    .replace('__SYNOPSIS__', packageJson.app.synopsis);

  const config = JSON.parse(rawConfig);
  const targetPlatform = PLATFORM_MAP[process.platform];

  const target = process.env.BUILD_TARGETS
    ? process.env.BUILD_TARGETS.split(',')
    : config[targetPlatform].target;

  return electronBuilder.build({
    publish: shouldPublish() ? 'always' : 'never',
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

// Only release if we're building a tag that ends in a version number
function shouldPublish() {
  const gitRefStr = process.env.GITHUB_REF || process.env.TRAVIS_TAG;

  if (!gitRefStr || !gitRefStr.match(/v\d+\.\d+\.\d+(-(beta|alpha)\.\d+)?$/)) {
    return false;
  }

  return true;
}
