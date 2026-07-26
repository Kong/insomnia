import fs from 'node:fs';
import path from 'node:path';

import { expect, type Page } from '@playwright/test';

import { test } from '../../playwright/test';

// Same check as sandbox-ancestor-check-cross-workspace-scope.test.ts, but the two collections live in
// two separate projects instead of two workspaces in one project — proving the fix isn't accidentally
// scoped to "same project" in a way that would miss a project-level bypass. The underlying check
// compares workspace ids directly, so this is expected to produce identical results; if it doesn't,
// that's a real gap the workspace-only test can't see.

const PLUGIN_NAME = 'insomnia-plugin-ancestor-check-cross-project-probe';
// Body text of the "target" request in sandbox-ancestor-check-target.yaml, reused from the
// cross-workspace test's fixtures.
const MARKER = 'TARGET-CONTENT-MARKER-h5k9q2';
const BODY_CODE_MIRROR = '[data-testid="request-pane"] [data-testid="CodeEditor"] .CodeMirror';

const installProbePlugin = (dataPath: string) => {
  const pluginDir = path.join(dataPath, 'plugins', PLUGIN_NAME);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, 'package.json'),
    JSON.stringify({ name: PLUGIN_NAME, version: '1.0.0', main: 'index.js', insomnia: {} }),
  );
  fs.writeFileSync(
    path.join(pluginDir, 'index.js'),
    `
      module.exports.templateTags = [
        {
          name: 'crossprojectreadprobe',
          displayName: 'Cross Project Read Probe',
          args: [{ displayName: 'Target Request Id', type: 'string', defaultValue: '' }],
          async run(context, targetId) {
            var doc = await context.util.models.request.getById(targetId);
            return (doc && doc.body && doc.body.text) || 'NONE';
          },
        },
      ];
    `,
  );
};

const clearPluginToast = async (page: Page) => {
  await page.getByLabel('Import').waitFor();
  await page.evaluate(() => localStorage.setItem('plugin-system-changes-toast-shown', 'true'));
  const dismissButtons = page.getByRole('button', { name: 'Dismiss' });
  await dismissButtons
    .first()
    .waitFor({ timeout: 3000 })
    .catch(() => {});
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && (await dismissButtons.count()) > 0) {
    await dismissButtons.first().click({ force: true, timeout: 500 }).catch(() => {});
  }
};

const enableSandbox = async (page: Page) => {
  await page.getByTestId('settings-button').click();
  const sandboxToggle = page.getByTestId('toggle-template-tag-sandbox');
  await page.getByRole('tab', { name: 'Scripting' }).click();
  await sandboxToggle.getByRole('switch').waitFor();
  await sandboxToggle.click();
  await expect.soft(sandboxToggle.getByRole('switch')).toBeChecked();
  await page.locator('.app').press('Escape');
  await expect.soft(page.getByTestId('toggle-template-tag-sandbox')).toBeHidden();
};

test('a template tag refuses to read a request that belongs to a different project', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  installProbePlugin(dataPath);
  await clearPluginToast(page);

  // Probe Collection lands in the default project.
  await insomnia.projectPage.importFixture('sandbox-ancestor-check-probe.yaml');
  await insomnia.projectPage.navigateFromWorkspaceBreadcrumb();

  // Target Collection lands in a second, separate project.
  await insomnia.projectPage.createProject('Cross Project Target', 'local');
  await insomnia.projectPage.importFixture('sandbox-ancestor-check-target.yaml');

  const targetRequestId: string = await page.evaluate(async () => {
    const requests = await (window as any).database.invoke('find', 'Request', {});
    const target = requests.find((r: any) => r.name === 'target');
    if (!target) {
      throw new Error('target request not found after import');
    }
    return target._id;
  });

  await page.evaluate(() => (window as any).main.plugins.reloadPlugins());

  await insomnia.navigationSidebar.selectProject('Personal Workspace');
  await insomnia.projectPage.workspaceList.openWorkspace('Ancestor Check Probe Collection');
  await insomnia.navigationSidebar.clickRequestOrFolder('Tag Probe');
  await page.getByText('Body', { exact: true }).click();
  await expect.soft(page.locator(BODY_CODE_MIRROR)).toContainText('PLACEHOLDER_TAG_TEXT');
  await page.evaluate(
    ({ sel, value }) => {
      const node = document.querySelector(sel) as any;
      node?.CodeMirror?.setValue(value);
    },
    { sel: BODY_CODE_MIRROR, value: `{% crossprojectreadprobe '${targetRequestId}' %}` },
  );
  await expect.soft(page.locator(BODY_CODE_MIRROR)).not.toContainText('PLACEHOLDER_TAG_TEXT');

  await enableSandbox(page);

  const readTagPreview = async (): Promise<string> => {
    await page.locator("[data-template^=\"{% crossprojectreadprobe\"]").click();
    const modal = page.getByRole('dialog');
    const preview = modal.getByLabel('Live Preview');
    await expect.soft(preview).not.toHaveValue('rendering...');
    const value = (await preview.inputValue()).trim();
    await modal.getByRole('button', { name: 'Done' }).click();
    await expect.soft(modal).toBeHidden();
    return value;
  };

  await expect.poll(readTagPreview, { timeout: 20_000 }).toBe('NONE');
  const finalPreview = await readTagPreview();
  expect.soft(finalPreview).not.toContain(MARKER);
});
