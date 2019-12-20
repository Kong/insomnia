const packageJson = require('../package.json');
const https = require('https');
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
      // Bintray env vars for publishing
      BT_USER,
      BT_TOKEN,

      // Bintray env vars for consuming (auto-updater)
      BT_UPDATES_USER,
      BT_UPDATES_TOKEN,
    } = process.env;

    const { isInternalBuild, publish, gitRef, gitCommit } = shouldPublish();
    if (!publish) {
      console.log(`[package] Not packaging for ref=${gitRef}`);
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

    // Generate version if it's internal
    let version = packageJson.app.version;
    let bintrayRepo = 'studio';

    // Generate internal build number if it's internal
    if (isInternalBuild) {
      version = `${version}-sha.${gitCommit.slice(0, 8)}`;
      bintrayRepo = 'studio-internal';
    }

    try {
      await buildTask.start(version);
      await start(bintrayRepo, version);
    } catch (err) {
      console.log('[package] ERROR:', err);
      process.exit(1);
    }
  });
}

async function start(bintrayRepo, version) {
  console.log('[package] Removing existing directories');

  if (process.env.KEEP_DIST_FOLDER !== 'yes') {
    await emptyDir('../dist/*');
  }

  console.log('[package] Packaging app');
  await pkg('../.electronbuilder', bintrayRepo, version);

  console.log('[package] Complete!');
}

async function ensureBintrayVersion(bintrayRepo, version) {
  return new Promise((resolve, reject) => {
    const { BT_USER, BT_TOKEN } = process.env;

    const req = https.request(`https://api.bintray.com/packages/kong/${bintrayRepo}/desktop/versions`, {
      method: 'POST',
      auth: [BT_USER, BT_TOKEN].join(':'),
      headers: { 'Content-Type': 'application/json' },
    }, res => {
      res.setEncoding('utf8');
      let body = [];
      res.on('data', chunk => {
        body += chunk;
      });
      res.on('end', () => {
        resolve(JSON.parse(body));
      });
    });

    req.on('error', err => {
      reject(err);
    });

    req.write(JSON.stringify({ name: version }));
    req.end();
  });
}

async function pkg(relConfigPath, bintrayRepo, version) {
  const configPath = path.resolve(__dirname, relConfigPath);

  // Replace some things
  const rawConfig = fs
    .readFileSync(configPath, 'utf8')
    .replace('__APP_ID__', packageJson.app.appId)
    .replace('__ICON_URL__', packageJson.app.icon)
    .replace('__EXECUTABLE_NAME__', packageJson.app.executableName)
    .replace('__BT_USER__', process.env.BT_USER)
    .replace('__BT_REPO__', bintrayRepo)
    .replace('__SYNOPSIS__', packageJson.app.synopsis);

  const config = JSON.parse(rawConfig);
  const targetPlatform = PLATFORM_MAP[process.platform];

  const target = process.env.BUILD_TARGETS
    ? process.env.BUILD_TARGETS.split(',')
    : config[targetPlatform].target;

  await ensureBintrayVersion(bintrayRepo, version);

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
    FORCE_PACKAGE,
  } = process.env;

  const gitCommit = GITHUB_SHA || TRAVIS_COMMIT;
  const gitRef = GITHUB_REF || TRAVIS_TAG || '';
  const isInternalBuild = gitRef.match(/master$/);
  const publish = (
    FORCE_PACKAGE === 'true' ||
    isInternalBuild ||
    gitRef.match(/v\d+\.\d+\.\d+(-([a-z]+)\.\d+)?$/i)
  );

  return {
    publish,
    isInternalBuild,
    gitRef,
    gitCommit,
  };
}
