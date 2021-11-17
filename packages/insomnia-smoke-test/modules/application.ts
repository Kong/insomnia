import fs from 'fs';
import mkdirp from 'mkdirp';
import os from 'os';
import path from 'path';
import { Application } from 'spectron';

// @ts-expect-error TSCONVERSION
import electronPath from '../../insomnia-app/node_modules/electron';

const getAppPlatform = () => process.platform;
const isMac = () => getAppPlatform() === 'darwin';
const isLinux = () => getAppPlatform() === 'linux';
const isWindows = () => getAppPlatform() === 'win32';

export const isBuild = () => process.env.BUNDLE === 'build';
export const isPackage = () => process.env.BUNDLE === 'package';

const spectronConfig = (
  designerDataPath = path.join(__dirname, '..', 'fixtures', 'doesnt-exist'),
) => {
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
    // @ts-expect-error TSCONVERSION
    env.DESIGNER_DATA_PATH = designerDataPath;
  }

  return { buildPath, packagePath, env };
};

export const launchApp = async (designerDataPath?: string) => {
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

    startTimeout: 10000,
    waitTimeout: 10000,
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

    // Set bounds to default size
    await app.browserWindow.setSize(1280, 700);
  });
  return app;
};

export const stop = async app => {
  await takeScreenshotOnFailure(app);

  if (app?.isRunning()) {
    await app.stop();
  }
};

const takeScreenshotOnFailure = async app => {
  // @ts-expect-error TSCONVERSION
  if (jasmine.currentTest.failedExpectations.length) {
    // @ts-expect-error TSCONVERSION
    await takeScreenshot(app, jasmine.currentTest.fullName.replace(/ /g, '_'));
  }
};

export const takeScreenshot = async (app, name) => {
  mkdirp.sync('screenshots');
  const buffer = await app.browserWindow.capturePage();
  await fs.promises.writeFile(path.join('screenshots', `${name}.png`), buffer);
};

export const writeTextToClipboard = (app: Application, text: string) => {
  app.electron.clipboard.writeText(text);
};
