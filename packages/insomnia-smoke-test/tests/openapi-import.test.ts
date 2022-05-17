import { expect } from '@playwright/test';

import { test } from '../playwright/test';

test('can render Petstore internal example and can render errors', async ({ page }) => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
  const specPreview = page.locator('.information-container');
  const codeEditor = page.locator('[data-testid="CodeEditor"]');
  const tagsOnTextEditor = page.locator('[data-testid="CodeEditor"] >> text=tags').first();
  const noticeTable = page.locator('_react=NoticeTable');
  await page.click('text=Design');
  await page.click('text=start from an example');
  await expect(codeEditor).toContainText('3.0.0');
  await expect(specPreview).toContainText('This is a sample server Petstore server');

  // Can render errors
  await tagsOnTextEditor.click();
  await tagsOnTextEditor.press('Tab');
  await expect(noticeTable).toContainText('oas3-schema Property `ta gs` is not expected to be here.');
});

const specs = [
  {
    url: 'https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/examples/v3.0/petstore.json',
    // url: 'http://localhost:4010/file/dummy-openapi.json', // TODO: fix import spec CORS issue
    name: 'json',
  },
  {
    url: 'https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/examples/v3.0/petstore.yaml',
    // url: 'http://localhost:4010/file/dummy-openapi.yaml', // TODO: fix import spec CORS issue
    name: 'yaml',
  },
];

for (const spec of specs) {
  test(`can import ${spec.name} from url from dashboard`, async ({ app, page }) => {
    await app.firstWindow(); // TODO: Convenience method that waits for app to be ready
    test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
    const specPreview = page.locator('.information-container');
    const codeEditor = page.locator('[data-testid="CodeEditor"]');
    await page.click('[data-testid="project"]');
    await page.click('text=Create');
    await page.click('button:has-text("URL")');

    // TODO: fix modal flakiness
    await page.click('input[id="prompt-input"]', { force: true });
    await page.fill('input[id="prompt-input"]', spec.url, { force: true });
    await page.click('text=Fetch and Import');

    await page.click('button:has-text("New")');
    await page.click('text=Design Document');
    await page.click('text=Ok');
    await page.click('text=Swagger Petstore 1.0.0');
    await expect(codeEditor).toContainText('3.0.0');
    await expect(specPreview).toContainText('Swagger Petstore');
  });

  test(`can import ${spec.name} from within an empty doc`, async ({ app, page }) => {
    await app.firstWindow(); // TODO: Convenience method that waits for app to be ready
    test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
    const specPreview = page.locator('.information-container');
    const codeEditor = page.locator('[data-testid="CodeEditor"]');
    await page.click('text=Design');
    await page.click('text=Import OpenAPI');
    await page.click('button:has-text("URL")');

    // TODO: fix modal flakiness
    await page.click('input[id="prompt-input"]', { force: true });
    await page.fill('input[id="prompt-input"]', spec.url, { force: true });
    await page.click('text=Fetch and Import');

    await expect(codeEditor).toContainText('3.0.0');
    await expect(specPreview).toContainText('Swagger Petstore');
  });

  test(`can import ${spec.name} from import/export menu`, async ({ app, page }) => {
    test.fail(); // FAILING DUE TO https://linear.app/insomnia/issue/INS-1393/no-text-rendered-when-folks-import-a-file-into-an-empty-design-doc
    await app.firstWindow(); // TODO: Convenience method that waits for app to be ready
    test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');
    const codeEditor = page.locator('[data-testid="CodeEditor"]');
    const specPreview = page.locator('.information-container');
    await page.click('text=Design');
    await page.click('button:has-text("New Document")');
    await page.click('button:has-text("Import/Export")');
    await page.click('text=Import Data');
    await page.click('#dropdowns-container button:has-text("From URL")');

    // TODO: fix modal flakiness
    await page.click('input[id="prompt-input"]', { force: true });
    await page.fill('input[id="prompt-input"]', spec.url, { force: true });
    await page.click('text=Fetch and Import');

    await page.locator('text=Ok').first().click();
    await expect(codeEditor).toContainText('3.0.0');
    await expect(specPreview).toContainText('Swagger Petstore');
  });
}
