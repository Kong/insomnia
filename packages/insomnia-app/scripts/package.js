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
    const { publish, gitRef } = shouldPublish();
    if (!publish) {
      console.log(`[package] Not packaging for ref=${gitRef}`);
      process.exit(0);
    }

    try {
      await buildTask.start();
      await start();
    } catch (err) {
      console.log('[package] ERROR:', err);
      process.exit(1);
    }
  });
}

async function start() {
  console.log('[package] Removing existing directories');

  if (process.env.KEEP_DIST_FOLDER !== 'yes') {
    await emptyDir('../dist/*');
  }

  console.log('[package] Packaging app');
  await pkg('../.electronbuilder');

  console.log('[package] Complete!');
}

async function pkg(relConfigPath) {
  const configPath = path.resolve(__dirname, relConfigPath);

  const [githubOwner, githubRepo] = packageJson.app.publishRepo.split('/');

  // Replace some things
  const rawConfig = fs
    .readFileSync(configPath, 'utf8')
    .replace('__APP_ID__', packageJson.app.appId)
    .replace('__ICON_URL__', packageJson.app.icon)
    .replace('__GITHUB_REPO__', githubRepo)
    .replace('__GITHUB_OWNER__', githubOwner)
    .replace('__EXECUTABLE_NAME__', packageJson.app.executableName)
    .replace('__SYNOPSIS__', packageJson.app.synopsis);

  const config = JSON.parse(rawConfig);
  const targetPlatform = PLATFORM_MAP[process.platform];

  const target = process.env.BUILD_TARGETS
    ? process.env.BUILD_TARGETS.split(',')
    : config[targetPlatform].target;

  return electronBuilder.build({
    publish: 'always',
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
  const {
    GITHUB_REF,
    GITHUB_SHA,
    TRAVIS_TAG,
    TRAVIS_COMMIT,
    TRAVIS_CURRENT_BRANCH,
    FORCE_PACKAGE,
  } = process.env;

  const gitCommit = GITHUB_SHA || TRAVIS_COMMIT;
  const gitRef = GITHUB_REF || TRAVIS_TAG || TRAVIS_CURRENT_BRANCH || '';
  const publish = (
    FORCE_PACKAGE === 'true' ||
    gitRef.match(/v\d+\.\d+\.\d+(-([a-z]+)\.\d+)?$/i)
  );

  return {
    publish,
    gitRef,
    gitCommit,
  };
}
