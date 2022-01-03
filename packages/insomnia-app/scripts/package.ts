import * as electronBuilder from 'electron-builder';
import path from 'path';
import rimraf from 'rimraf';

import appConfig from '../config/config.json';
import electronBuilderConfig from '../config/electronbuilder.json';
import { start as build } from './build';

const PLATFORM_MAP = {
  darwin: 'mac',
  linux: 'linux',
  win32: 'win',
} as const;

// Start package if ran from CLI
if (require.main === module) {
  process.nextTick(async () => {
    try {
      await build({ forceFromGitRef: false });
      await module.exports.start();
    } catch (err) {
      console.log('[package] ERROR:', err);
      process.exit(1);
    }
  });
}

const pkg = () => {
  const { BUILD_TARGETS } = process.env;
  const {
    appId,
    binaryPrefix,
    executableName,
    githubOrg,
    githubRepo,
    icon,
    synopsis,
  } = appConfig;

  // Replace some things
  const rawConfig = JSON.stringify(electronBuilderConfig, null, 2)
    .replace(/__APP_ID__/g, appId)
    .replace(/__BINARY_PREFIX__/g, binaryPrefix)
    .replace(/__EXECUTABLE_NAME__/g, executableName)
    .replace(/__GITHUB_OWNER__/g, githubOrg)
    .replace(/__GITHUB_REPO__/g, githubRepo)
    .replace(/__ICON_URL__/g, icon)
    .replace(/__SYNOPSIS__/g, synopsis);

  const config = JSON.parse(rawConfig);
  const targetPlatform = PLATFORM_MAP[process.platform];

  const target = BUILD_TARGETS?.split(',') ?? config[targetPlatform].target;

  return electronBuilder.build({
    config,
    [targetPlatform]: target,
    ...targetPlatform === 'mac' ? { universal: true } : {},
  });
};

const emptyDir = (relPath: string) => new Promise<void>((resolve, reject) => {
  const dir = path.resolve(__dirname, relPath);
  rimraf(dir, err => {
    if (err) {
      reject(err);
    } else {
      resolve();
    }
  });
});

export const start = async () => {
  console.log('[package] Removing existing directories');

  if (process.env.KEEP_DIST_FOLDER !== 'yes') {
    await emptyDir(path.join('..', 'dist', '*'));
  }

  console.log('[package] Packaging app');
  await pkg();

  console.log('[package] Complete!');
};
