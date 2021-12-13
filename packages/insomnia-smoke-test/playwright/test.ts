import {
  Electron,
  ElectronApplication,
  test as base,
} from '@playwright/test';
import os from 'os';
import path from 'path';
import * as uuid from 'uuid';

export async function runElectronApp(electron: Electron, envOptions = {}) {
  const mainPath = path.resolve(
    __dirname,
    '..',
    '..',
    'insomnia-app',
    'build',
    'main.min.js'
  );

  // const executablePath = path.resolve(
  //   __dirname,
  //   '..',
  //   '..',
  //   'insomnia-app',
  //   'node_modules/.bin',
  //   process.platform === 'win32' ? 'electron.cmd' : 'electron'
  // );

  console.log({
    mainPath, // executablePath,
    envOptions,
  });
  return electron.launch({
    // executablePath,
    args: [mainPath],
    env: {
      ...process.env,
      ...envOptions,
      ELECTRON_ENABLE_LOGGING: 'true',
      PLAYWRIGHT: 'true',
    },
  });
}

const insomniaTestFixture = base.extend<{
  insomniaApp: ElectronApplication;
}>({
  insomniaApp: async ({ playwright }, use) => {
    const INSOMNIA_DATA_PATH = path.resolve(os.tmpdir(), 'insomnia-smoke-test', `${uuid.v4()}`);
    const insomniaApp = await runElectronApp(playwright._electron, { INSOMNIA_DATA_PATH });

    await use(insomniaApp);

    await insomniaApp.close();
  },
});

export { insomniaTestFixture };
export { expect } from '@playwright/test';
