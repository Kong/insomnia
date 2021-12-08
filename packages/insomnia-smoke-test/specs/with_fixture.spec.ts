import { loadFixture } from '../modules/fixtures';
import { expect, test } from './test';

test('can send requests', async ({ insomniaApp }) => {
  await insomniaApp.waitForEvent('window');
  const page = await insomniaApp.firstWindow();
  await page.click('text=Don\'t share usage analytics');
  await page.click('text=Skip');
  await page.click('text=Create');

  const requestCollectionFixture = await loadFixture('insomnia-request-collection.yaml');
  await insomniaApp.evaluate(async ({ clipboard }, requestCollectionFixture) => {
    // This runs in the main Electron process, parameter here is always
    // the result of the require('electron') in the main app script.
    return clipboard.writeText(requestCollectionFixture);
  }, requestCollectionFixture);

  await page.click('button:has-text("Clipboard")');
  await page.click('text=Smoke tests');
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

// test('sends JSON request', async ({ insomniaApp }) => {
//   await insomniaApp.waitForEvent('window');
//   const page = await insomniaApp.firstWindow();
//   await page.waitForEvent('load');
//   await page.click('button:has-text("Don\'t share usage analytics")');
//   await page.click('button:has-text("Skip")');
//   // await page.click('button:has-text("skipForNow")');
//   await page.click('text=Create');
//   await page.click('button:has-text("Request Collection")');
//   await page.fill('[placeholder="My Collection"]', 'Cool guy');
//   await page.press('[placeholder="My Collection"]', 'Enter');
//   await page.click('button:has-text("New Request")');
//   await page.fill('[placeholder="My Request"]', 'JSON');
//   await page.press('[placeholder="My Request"]', 'Enter');
//   await page.click('_react=RequestUrlBar');
//   await page.keyboard.type('http://127.0.0.1:4010/pets/1');
//   await page.keyboard.down('Enter');
//   await page.click('li[role="tab"]:has-text("Timeline")');
//   await page.click('pre[role="presentation"]:has-text("< HTTP/1.1 200 OK")');
//   const title = await page.title();
//   expect(title).toEqual('Insomnia');
// });
