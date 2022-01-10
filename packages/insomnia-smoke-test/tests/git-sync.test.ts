import { ElectronApplication, test } from '@playwright/test';
import { exec } from 'child_process';

import {
  cwd,
  executablePath,
  mainPath,
  randomDataPath,
} from '../playwright/paths';

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
    console.log(
      'Starting git-http-mock-server on port',
      GIT_HTTP_MOCK_SERVER_PORT
    );

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
  page: async ({ insomniaApp }, use) => {
    const page = await insomniaApp.firstWindow();

    if (process.platform === 'win32') await page.reload();

    await page.click("text=Don't share usage analytics");

    await use(page);

    await page.close();
  },
});

insomniaTest('Git Sync', async ({ page, gitServer }) => {
  // Set up Git Sync
  await page.click('text=Setup Git Sync');

  await page.click('button:has-text("Repository Settings")');

  await page.fill(
    '[placeholder="https://github.com/org/repo.git"]',
    `${gitServer}/example.git`
  );

  await page.press('[placeholder="https://github.com/org/repo.git"]', 'Tab');

  await page.fill('[placeholder="Name"]', 'sleepyhead');

  await page.press('[placeholder="Name"]', 'Tab');

  await page.fill('[placeholder="Email"]', 'sleepyhead@konghq.com');

  await page.press('[placeholder="Email"]', 'Tab');

  await page.fill('[placeholder="MyUser"]', 'sleepyhead');

  await page.press('[placeholder="MyUser"]', 'Tab');

  await page.fill(
    '[placeholder="88e7ee63b254e4b0bf047559eafe86ba9dd49507"]',
    'supersecrettoken'
  );

  await page.press(
    '[placeholder="88e7ee63b254e4b0bf047559eafe86ba9dd49507"]',
    'Tab'
  );

  await page.press('text=Done', 'Enter');

  // Create a new commit
  await page.click('button:has-text("master")');

  await page.click('button:has-text("Commit")');

  await page.fill('textarea[name="commit-message"]', 'Initial commit');

  await page.check('input[name="select-all"]');

  await page.click('button:has-text("Commit")');

  // Push the new commit to the remote
  await page.click('button:has-text("master")');

  await page.click('button:has-text("Push")');

  // Create a new branch
  await page.click('button:has-text("Branches")');

  await page.fill('[placeholder="testing-branch"]', 'new-feature');

  await page.press('[placeholder="testing-branch"]', 'Enter');

  await page.click('text=Done');

  // Create a new request
  await page.click('div:nth-child(3) .btn');

  await page.click('button:has-text("New Request⌘ N")');

  await page.press('[placeholder="My Request"]', 'Enter');

  // Commit the new changes
  await page.click('button:has-text("new-feature")');

  await page.click('button:has-text("Commit")');

  await page.fill('textarea[name="commit-message"]', 'Add new request');

  await page.check('input[name="select-all"]');

  await page.click('button:has-text("Commit")');

  await page.click('button:has-text("new-feature")');

  await page.click('button:has-text("History (2)")');

  await page.click('text=Add new request');

  await page.click('text=Done');

  // Merge the new branch to master
  await page.click('button:has-text("new-feature")');

  await page.click('button:has-text("Branches")');

  await page.click('text=Checkout');

  await page.click('text=Merge');

  await page.click('button:has-text("Click to confirm")');

  await page.click('text=Local Branches');

  await page.click('text=Done');
});
