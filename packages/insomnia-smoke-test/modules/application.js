import { Application } from 'spectron';
import path from 'path';
import os from 'os';
import electronPath from '../../insomnia-app/node_modules/electron';
import { APP_ID_INSOMNIA, APP_ID_DESIGNER } from '../../insomnia-app/config';

const getAppPlatform = () => process.platform;
const isMac = () => getAppPlatform() === 'darwin';
const isLinux = () => getAppPlatform() === 'linux';
const isWindows = () => getAppPlatform() === 'win32';

const spectronConfig = appId => {
  let packagePathSuffix = '';
  if (isWindows()) {
    packagePathSuffix = 'win-unpacked/Insomnia.exe';
  } else if (isMac()) {
    packagePathSuffix = 'mac/Insomnia.app/Contents/MacOS/Insomnia';
  } else if (isLinux()) {
    packagePathSuffix = ''; // TODO: find out what this is
  }

  const buildPath = path.join(__dirname, '../../insomnia-app/build', appId);
  const packagePath = path.join(__dirname, '../../insomnia-app/dist', appId, packagePathSuffix);
  const dataPath = path.join(os.tmpdir(), 'insomnia-smoke-test', appId, `${Math.random()}`);

  return { buildPath, packagePath, dataPath };
};

export const launchCore = async () => {
  const config = spectronConfig(APP_ID_INSOMNIA);
  return await launch(config);
};

export const launchDesigner = async () => {
  const config = spectronConfig(APP_ID_DESIGNER);
  return await launch(config);
};

const getLaunchPath = config =>
  process.env.BUNDLE === 'package'
    ? { path: config.packagePath }
    : {
        path: electronPath,
        args: [config.buildPath],
      };

const launch = async config => {
  if (!config) {
    throw new Error('Spectron config could not be loaded.');
  }

  const app = new Application({
    ...getLaunchPath(config),

    // Don't remove chromeDriverArgs
    // https://github.com/electron-userland/spectron/issues/353#issuecomment-522846725
    chromeDriverArgs: ['remote-debugging-port=9222'],

    env: {
      INSOMNIA_DATA_PATH: config.dataPath,
    },
  });

  await app.start().then(async () => {
    // Windows spawns two terminal windows when running spectron, and the only workaround
    // is to focus the window on start.
    // https://github.com/electron-userland/spectron/issues/60
    await app.browserWindow.focus();
    await app.browserWindow.setAlwaysOnTop(true);
  });

  return app;
};

export const stop = async app => {
  if (app && app.isRunning()) {
    await app.stop();
  }
};
