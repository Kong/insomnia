import {
  ElectronApplication,
  test,
} from '@playwright/test';
import { exec } from 'child_process';

import {
  cwd,
  executablePath,
  mainPath,
  randomDataPath,
} from '../playwright/paths';

// NOTE: the DESIGNER_DATA_PATH argument is only used for overriding paths for migration testing,
// if we remove migration from insomnia designer support this testing flow can be simplifed.
interface EnvOptions {
  INSOMNIA_DATA_PATH: string;
  DESIGNER_DATA_PATH?: string;
}

const insomniaTest = test.extend<{
  gitServer: string;
  insomniaApp: ElectronApplication;
}>({
  gitServer: async ({}, use) => {
    const GIT_HTTP_MOCK_SERVER_PORT = '8174';
    console.log('Starting git-http-mock-server on port', GIT_HTTP_MOCK_SERVER_PORT);

    const mockServerProcess = exec('npm run mock:git-server');

    mockServerProcess.on('message', message => {
      console.log(message);
    });

    mockServerProcess.on('error', console.log);

    await use(`http://localhost:${GIT_HTTP_MOCK_SERVER_PORT}`);

    mockServerProcess.kill();
  },
  insomniaApp: async ({ playwright }, use) => {
    const options: EnvOptions = { INSOMNIA_DATA_PATH: randomDataPath() };

    if (!options.DESIGNER_DATA_PATH)
      options.DESIGNER_DATA_PATH = 'doesnt-exist';

    const electronApp = await playwright._electron.launch({
      cwd,
      executablePath,
      args: process.env.BUNDLE === 'package' ? [] : [mainPath],
      env: {
        ...process.env,
        ...options,
        PLAYWRIGHT: 'true',
      },
    });

    await electronApp.waitForEvent('window');

    await use(electronApp);

    await electronApp.close();
  },
});

insomniaTest.only('git sync', async ({ insomniaApp, gitServer }) => {
  const page = await insomniaApp.firstWindow();

  await page.click('text=Don\'t share usage analytics');

  await page.click('text=Setup Git Sync');

  await page.click('button:has-text("Repository Settings")');

  await page.fill('[placeholder="https://github.com/org/repo.git"]', `${gitServer}/example.git`);

  await page.press('[placeholder="https://github.com/org/repo.git"]', 'Tab');

  await page.fill('[placeholder="Name"]', 'sleepyhead');

  await page.press('[placeholder="Name"]', 'Tab');

  await page.fill('[placeholder="Email"]', 'sleepyhead@konghq.com');

  await page.press('[placeholder="Email"]', 'Tab');

  await page.fill('[placeholder="MyUser"]', 'sleepyhead');

  await page.press('[placeholder="MyUser"]', 'Tab');

  await page.fill('[placeholder="88e7ee63b254e4b0bf047559eafe86ba9dd49507"]', 'supersecrettoken');

  await page.press('[placeholder="88e7ee63b254e4b0bf047559eafe86ba9dd49507"]', 'Tab');

  await page.press('text=Done', 'Enter');

  await page.click('button:has-text("master")');

  await page.click('button:has-text("Commit")');

  await page.click('textarea[name="commit-message"]');

  await page.click('textarea[name="commit-message"]');

  await page.fill('textarea[name="commit-message"]', 'Initial commit');

  await page.check('input[name="select-all"]');

  await page.click('button:has-text("Commit")');

  await page.click('button:has-text("master")');

  await page.click('button:has-text("Push")');
});
