import { Application } from 'spectron';
import path from 'path';
import os from 'os';
import electronPath from '../../insomnia-app/node_modules/electron';

const getAppPlatform = () => process.platform;
const isMac = () => getAppPlatform() === 'darwin';
const isLinux = () => getAppPlatform() === 'linux';
const isWindows = () => getAppPlatform() === 'win32';

export const isBuild = () => process.env.BUNDLE === 'build';
export const isPackage = () => process.env.BUNDLE === 'package';

const spectronConfig = designerDataPath => {
  let packagePathSuffix = '';
  if (isWindows()) {
    packagePathSuffix = path.join('win-unpacked', 'Insomnia.exe');
  } else if (isMac()) {
    packagePathSuffix = path.join('mac', 'Insomnia.app', 'Contents', 'MacOS', 'Insomnia');
  } else if (isLinux()) {
    packagePathSuffix = ''; // TODO: find out what this is
  }

  const buildPath = path.join(__dirname, '../../insomnia-app/build');
  const packagePath = path.join(__dirname, '../../insomnia-app/dist', packagePathSuffix);
  const dataPath = path.join(os.tmpdir(), 'insomnia-smoke-test', `${Date.now()}`);
  const env = { INSOMNIA_DATA_PATH: dataPath };

  if (designerDataPath) {
    env.DESIGNER_DATA_PATH = designerDataPath;
  }

  return { buildPath, packagePath, env };
};

export const launchApp = async designerDataPath => {
  const config = spectronConfig(designerDataPath);
  return await launch(config);
};

const getLaunchPath = config =>
  isPackage()
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

    env: config.env,
  });

  await app.start().then(async () => {
    // Windows spawns two terminal windows when running spectron, and the only workaround
    // is to focus the window on start.
    // https://github.com/electron-userland/spectron/issues/60
    await app.browserWindow.focus();
    await app.browserWindow.setAlwaysOnTop(true);

    // Set the implicit wait timeout to 0 (webdriver default)
    //  https://webdriver.io/docs/timeouts.html#session-implicit-wait-timeout
    // Spectron overrides it to an unreasonable value, as per the issue
    //  https://github.com/electron-userland/spectron/issues/763
    await app.client.setTimeout({ implicit: 0 });
  });

  return app;
};

export const stop = async app => {
  if (app && app.isRunning()) {
    await app.stop();
  }
};
