import { expect, test } from './test';

test('can skip migration', async ({ insomniaApp }) => {
  await insomniaApp.waitForEvent('window');
  const page = await insomniaApp.firstWindow();
  await page.waitForEvent('load');
  await page.click('button:has-text("Don\'t share usage analytics")');
  await page.click('button:has-text("Skip")');
  // await page.click('button:has-text("skipForNow")');
});

test('sends JSON request', async ({ insomniaApp }) => {
  await insomniaApp.waitForEvent('window');
  const page = await insomniaApp.firstWindow();
  await page.waitForEvent('load');
  await page.click('button:has-text("Don\'t share usage analytics")');
  await page.click('button:has-text("Skip")');
  // await page.click('button:has-text("skipForNow")');
  await page.click('text=Create');
  await page.click('button:has-text("Request Collection")');
  await page.fill('[placeholder="My Collection"]', 'Cool guy');
  await page.press('[placeholder="My Collection"]', 'Enter');
  await page.click('button:has-text("New Request")');
  await page.fill('[placeholder="My Request"]', 'JSON');
  await page.press('[placeholder="My Request"]', 'Enter');
  await page.click('_react=RequestUrlBar');
  await page.keyboard.type('http://127.0.0.1:4010/pets/1');
  await page.keyboard.down('Enter');
  await page.click('li[role="tab"]:has-text("Timeline")');
  await page.click('pre[role="presentation"]:has-text("< HTTP/1.1 200 OK")');
  const title = await page.title();
  expect(title).toEqual('Insomnia');
});
