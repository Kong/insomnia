import {
  Electron,
  ElectronApplication,
  test as base,
} from '@playwright/test';
import os from 'os';
import path from 'path';

async function runElectronApp(electron: Electron) {
  const mainPath = path.join(
    __dirname,
    '..',
    '..',
    'insomnia-app',
    'build',
    'main.min.js'
  );

  const executablePath = path.join(
    __dirname,
    '..',
    '..',
    'insomnia-app',
    'node_modules/.bin/electron'
  );

  const dataPath = path.join(os.tmpdir(), 'insomnia-smoke-test', `${Date.now()}`);

  const insomniaApp = await electron.launch({
    executablePath,
    args: [mainPath],
    env: {
      ...process.env,
      ELECTRON_ENABLE_LOGGING: 'true',
      INSOMNIA_DATA_DIR: dataPath,
      INSOMNIA_DATA_PATH: dataPath,
      PLAYWRIGHT: 'true',
    },
    recordVideo: {
      size: {
        width: 640,
        height: 480,
      },
      dir: 'videos/',
    },
  });

  return insomniaApp;
}

const test = base.extend<{
  insomniaApp: ElectronApplication;
}>({
  insomniaApp: async ({ playwright }, use) => {
    const insomniaApp = await runElectronApp(playwright._electron);

    await use(insomniaApp);

    await insomniaApp.close();
  }
});

export { test };
export { expect } from '@playwright/test';
