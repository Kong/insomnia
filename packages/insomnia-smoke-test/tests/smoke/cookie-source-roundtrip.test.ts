import fs from 'node:fs';
import path from 'node:path';

import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';
import { cleanupExportDir, createTempExportDir, waitForExportFiles } from '../../playwright/utils';

const importFromClipboardText = async (app: any, page: any, text: string) => {
  await app.evaluate(async ({ clipboard }: any, text: string) => clipboard.writeText(text), text);
  await page.getByLabel('Import').click();
  await page.locator('[data-test-id="import-from-clipboard"]').click();
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
};

const sendAndReadCookieEcho = async (page: any, insomnia: any, workspaceName: string) => {
  const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
  const responsePaneContents = page.locator('[data-testid="response-pane"] >> [data-testid="CodeEditor"]:visible', {
    has: page.locator('.CodeMirror-activeline'),
  });
  await insomnia.navigationSidebar.clickRequestOrFolder('echo-cookies', workspaceName);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect.soft(statusTag).toContainText('200 OK');
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByRole('menuitem', { name: 'Raw Data' }).click();
  return responsePaneContents;
};

// Imports the fixture, exports it through the real UI as Insomnia v5 YAML and returns the exported text.
const importFixtureAndExport = async (app: any, page: any, insomnia: any, tempDir: string) => {
  await importFromClipboardText(app, page, await loadFixture('cookie-source-collection.yaml'));
  const exportFilePath = path.join(tempDir, 'cookie-source-export.yaml');
  await insomnia.workspacePage.exportWorkspaceFromDropdown('cookieSource', exportFilePath, 'yaml');
  await waitForExportFiles(tempDir, 1);
  return fs.readFileSync(exportFilePath, 'utf8');
};

// Returns the exported YAML cookie entries keyed by cookie name.
const cookieBlocks = (yaml: string) => {
  const blocks: Record<string, string> = {};
  for (const chunk of yaml.split(/\n\s*- (?=(?:id|key|domain|value|path|expires|maxAge|secure|httpOnly|hostOnly|creation|lastAccessed|source):)/)) {
    const key = chunk.match(/^\s*(?:- )?key: (\S+)/m)?.[1];
    if (key) {
      blocks[key] = chunk;
    }
  }
  return blocks;
};

// The fixture contains one `source: manual`, one `source: response` and one untagged cookie.
test.describe('cookie source export/import round trip', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test('new-to-new: exported v5 YAML keeps cookie source so response cookies stay literal after re-import', async ({
    app,
    page,
    insomnia,
  }) => {
    const tempDir = createTempExportDir();
    try {
      const exported = await importFixtureAndExport(app, page, insomnia, tempDir);
      const blocks = cookieBlocks(exported);
      expect.soft(blocks.cookieManual).toMatch(/source: manual/);
      expect.soft(blocks.cookieResponse).toMatch(/source: response/);
      expect.soft(blocks.cookieManual).not.toMatch(/source: response/);
      expect.soft(blocks.cookieResponse).not.toMatch(/source: manual/);

      // Re-import the exported text into a fresh project
      await insomnia.workspacePage.goBackToProject();
      await insomnia.projectPage.createProject('Cookie Roundtrip Project', 'local');
      // Rename the workspace so the re-imported copy is distinguishable in the sidebar from the original
      await importFromClipboardText(app, page, exported.replace('name: cookieSource\n', 'name: cookieSourceReimported\n'));

      const responsePaneContents = await sendAndReadCookieEcho(page, insomnia, 'cookieSourceReimported');
      await expect.soft(responsePaneContents).toContainText('cookieManual=rendered');
      await expect.soft(responsePaneContents).toContainText("cookieResponse={{ 'rendered' }}");
    } finally {
      cleanupExportDir(tempDir);
    }
  });

  // PINS CURRENT KNOWN BEHAVIOUR (not a desired guarantee): an older client drops unknown `source` keys on
  // re-export, and an absent `source` is grandfathered to 'manual' on import, so a response cookie is downgraded
  // to manual and gets template-rendered. If the import default is deliberately changed to 'response', this
  // test should flip (cookieResponse literal) and be updated.
  test('old-client downgrade (pins current behaviour): stripped source lines make response cookie render as manual', async ({
    app,
    page,
    insomnia,
  }) => {
    const tempDir = createTempExportDir();
    try {
      const exported = await importFixtureAndExport(app, page, insomnia, tempDir);
      const stripped = exported
        .split('\n')
        .filter(line => !/^\s*source:\s*(manual|response)\s*$/.test(line))
        .join('\n');
      expect.soft(stripped).not.toMatch(/source:/);
      expect.soft(stripped).toContain('cookieResponse');

      await insomnia.workspacePage.goBackToProject();
      await insomnia.projectPage.createProject('Cookie Downgrade Project', 'local');
      // Rename the workspace so the re-imported copy is distinguishable in the sidebar from the original
      await importFromClipboardText(app, page, stripped.replace('name: cookieSource\n', 'name: cookieSourceStripped\n'));

      const responsePaneContents = await sendAndReadCookieEcho(page, insomnia, 'cookieSourceStripped');
      await expect.soft(responsePaneContents).toContainText('cookieManual=rendered');
      // Known grandfather-to-manual downgrade: previously-literal response cookie now arrives rendered.
      await expect.soft(responsePaneContents).toContainText('cookieResponse=rendered');
    } finally {
      cleanupExportDir(tempDir);
    }
  });
});
