import { loadFixture } from '../playwright/paths';
import { test } from '../playwright/test';

test('can send requests', async ({ app, page }) => {
  await page.click('[data-testid="project"]');
  await page.click('text=Create');

  const text = await loadFixture('smoke-test-collection.yaml');
  await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

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
});

test.describe.serial('given a designer and data directory', () => {
  test('should complete migration dialog', async ({ pageWithDesignerDataPath: page }) => {
    await page.click('text=Copy Workspaces');
    await page.click('text=Copy Plugins');
    await page.click('text=Copy Designer Application Settings');
    await page.click('text=Start Migration');
    await page.click('text=Migrated successfully!');
  });

  test('then on restart should see the migrated workspace', async ({ pageWithDesignerDataPath: page }) => {
    await page.click('text=Don\'t share usage analytics');
    await page.click('text=BASIC-DESIGNER-FIXTURE');
  });
});
