import { PlaywrightWorkerArgs, test } from '@playwright/test';

import { cwd, DESIGNER_DATA_PATH, executablePath, loadFixture, mainPath, randomDataPath } from '../playwright/paths';

// NOTE: the DESIGNER_DATA_PATH argument is only used for overriding paths for migration testing,
// if we remove migration from insomnia designer support this testing flow can be simplifed.
type Playwright = PlaywrightWorkerArgs['playwright'];
interface EnvOptions { INSOMNIA_DATA_PATH: string; DESIGNER_DATA_PATH?: string }

const newPage = async ({ playwright, options }: ({ playwright: Playwright; options: EnvOptions })) => {
  // NOTE: ensure the DESIGNER_DATA_PATH is ignored from process.env
  if (!options.DESIGNER_DATA_PATH) options.DESIGNER_DATA_PATH = 'doesnt-exist';
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
  const page = await electronApp.firstWindow();
  // @TODO: Investigate why the app doesn't start without a reload with playwright in windows
  if (process.platform === 'win32') await page.reload();
  return { electronApp, page };
};

test('can send requests', async ({ playwright }) => {
  const options = { INSOMNIA_DATA_PATH: randomDataPath() };
  const { page, electronApp } = await newPage({ playwright, options });
  await page.click('text=Don\'t share usage analytics');
  await page.click('[data-testid="project"]');
  await page.click('text=Create');

  const text = await loadFixture('smoke-test-collection.yaml');
  await electronApp.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

  await page.click('button:has-text("Clipboard")');
  await page.click('text=CollectionSmoke testsjust now');

  await page.click('button:has-text("GETdelayed request")');
  await page.click('text=http://127.0.0.1:4010/delay/seconds/20Send >> button');
  await page.click('text=Loading...Cancel Request >> button');
  await page.click('text=Request was cancelled');
  await page.click('button:has-text("GETsend JSON request")');
  await page.click('text=http://127.0.0.1:4010/pets/1Send >> button');
  await page.click('text=200 OK');
  await page.click('button:has-text("GETsends dummy.csv request and shows rich response")');
  await page.click('text=http://127.0.0.1:4010/file/dummy.csvSend >> button');
  await page.click('text=200 OK');
  await page.click('button:has-text("GETsends dummy.xml request and shows raw response")');
  await page.click('text=http://127.0.0.1:4010/file/dummy.xmlSend >> button');
  await page.click('text=200 OK');
  await page.click('button:has-text("GETsends dummy.pdf request and shows rich response")');
  await page.click('text=http://127.0.0.1:4010/file/dummy.pdfSend >> button');
  await page.click('text=200 OK');
  await page.click('button:has-text("GETsends request with basic authentication")');
  await page.click('text=http://127.0.0.1:4010/auth/basicSend >> button');
  await page.click('text=200 OK');
  await page.close();
});

test.describe.serial('given a designer and data directory', () => {
  const INSOMNIA_DATA_PATH = randomDataPath();

  test('should complete migration dialog', async ({ playwright }) => {
    const options = { DESIGNER_DATA_PATH, INSOMNIA_DATA_PATH };
    const { page } = await newPage({ playwright, options });
    await page.click('text=Copy Workspaces');
    await page.click('text=Copy Plugins');
    await page.click('text=Copy Designer Application Settings');
    await page.click('text=Start Migration');
    await page.click('text=Migrated successfully!');
    await page.close();
  });

  test('then on restart should see the migrated workspace', async ({ playwright }) => {
    const options = { DESIGNER_DATA_PATH, INSOMNIA_DATA_PATH };
    const { page } = await newPage({ playwright, options });
    await page.click('text=Don\'t share usage analytics');
    await page.click('text=BASIC-DESIGNER-FIXTURE');
    await page.close();
  });
});
