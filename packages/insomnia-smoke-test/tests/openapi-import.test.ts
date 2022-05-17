import { expect } from '@playwright/test';

import { test } from '../playwright/test';

test.skip('can render Petstore internal example', async ({ page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  const specPreview = page.locator('.information-container');
  const tagsOnTextEditor = page.locator('[data-testid="CodeEditor"] >> text=tags').first();
  const noticeTable = page.locator('_react=NoticeTable');
  await page.click('[data-testid="project"]');
  await page.click('text=Create');
  await page.click('button:has-text("Design Document")');
  await page.click('.modal__footer >> text=Create');
  await page.click('text=start from an example');

  await expect(specPreview).toContainText('This is a sample server Petstore server');

  // can render errors
  await tagsOnTextEditor.click();
  await tagsOnTextEditor.press('Tab');
  await expect(noticeTable).toContainText('oas3-schema Property `ta gs` is not expected to be here.');
});

// can import yaml from copy paste inside empty document
// test.skip('can render spec and requests when pasting OA3 yaml spec directly inside empty document', async ({ app, page }) => {
//   test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
//   const specPreview = page.locator('.information-container');
//   // const tagsOnTextEditor = page.locator('[data-testid="CodeEditor"] >> text=tags').first();
//   // const noticeTable = page.locator('_react=NoticeTable');
//   await page.click('[data-testid="project"]');
//   await page.click('text=Create');
//   await page.click('button:has-text("Design Document")');
//   await page.click('.modal__footer >> text=Create');
//   await page.click('pre[role="presentation"]:has-text("")');

//   const text = await loadFixture('openapi3.yaml');
//   await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
//   await expect(specPreview).toContainText('Smoke Test API server');
//   await expect(specPreview).toContainText('Make basic auth request');
//   await expect(specPreview).toContainText('Get dummy PDF file');
// });

// can import yaml from copy paste via import/export for empty document
// test('can render spec and requests when pasting OA3 yaml spec from import/export menu inside empty document', async ({ app, page }) => {
//   test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
//   // const specPreview = page.locator('.information-container');
//   // const tagsOnTextEditor = page.locator('[data-testid="CodeEditor"] >> text=tags').first();
//   // const noticeTable = page.locator('_react=NoticeTable');
//   await page.click('[data-testid="project"]');
//   await page.click('text=Create');
//   await page.click('button:has-text("Design Document")');
//   await page.click('.modal__footer >> text=Create');

//   console.log('debug');

// });

// can import json from copy paste inside empty document

// can import json from copy paste via import/export for empty document

// can import yaml from url inside empty document

// can import yaml from url via import/export for empty document

// can import json from url inside empty document

// can import json from url via import/export for empty document

// FOR ANOTHER FILE!!!!
// can import insomnia json collection

// can import insomnia yaml collection

// can import insomnia yaml design doc

// can import insomnia yaml design doc
