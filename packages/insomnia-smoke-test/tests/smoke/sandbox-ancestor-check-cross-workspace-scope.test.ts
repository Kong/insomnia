import fs from 'node:fs';
import path from 'node:path';

import { expect, type Page } from '@playwright/test';

import { test } from '../../playwright/test';

// Every models.read handler in the sandboxed Nunjucks bridge must verify the resolved record's
// Workspace ancestor matches the caller's own workspace before trusting it, so a plugin in one
// workspace can't read another workspace's records by id. Template tags, request hooks, and plugin
// actions all reach the same handlers, so all three are exercised here.
//
// Two separate fixture files (not one collection with two workspaces), so the probe's reference to
// the target's request id is a genuine cross-workspace reference rather than an in-batch import
// remap that would mask the bug.

const PLUGIN_NAME = 'insomnia-plugin-ancestor-check-probe';
const TARGET_MARKER = 'TARGET-CONTENT-MARKER-h5k9q2';
const BODY_CODE_MIRROR = '[data-testid="request-pane"] [data-testid="CodeEditor"] .CodeMirror';

// One plugin exercising all three surfaces: a template tag, a request hook, and a request action +
// readback tag (actions have no return channel of their own). Each attempts
// context.util.models.request.getById(targetId) and reports only the target's body text (or 'NONE'),
// never the id itself.
const installProbePlugin = (dataPath: string) => {
  const pluginDir = path.join(dataPath, 'plugins', PLUGIN_NAME);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, 'package.json'),
    JSON.stringify({
      name: PLUGIN_NAME,
      version: '1.0.0',
      main: 'index.js',
      insomnia: { permissions: { capabilities: ['storage'] } },
    }),
  );
  fs.writeFileSync(
    path.join(pluginDir, 'index.js'),
    `
      module.exports.templateTags = [
        {
          name: 'crossreadprobe',
          displayName: 'Cross Read Probe',
          description: 'Attempts to read another workspace\\'s request by id via a template tag',
          args: [{ displayName: 'Target Request Id', type: 'string', defaultValue: '' }],
          async run(context, targetId) {
            var doc = await context.util.models.request.getById(targetId);
            return (doc && doc.body && doc.body.text) || 'NONE';
          },
        },
        {
          name: 'actionreadback',
          displayName: 'Action Readback',
          description: 'Reads back what the request action wrote to plugin storage',
          args: [],
          async run(context) {
            return (await context.store.getItem('action_cross_read')) || 'unset';
          },
        },
      ];
      module.exports.requestHooks = [
        async function (context) {
          var targetId = (context.request.getBody().text || '').trim();
          var doc = await context.util.models.request.getById(targetId);
          var leaked = (doc && doc.body && doc.body.text) || 'NONE';
          context.request.setHeader('X-Cross-Read', leaked);
        },
      ];
      module.exports.requestActions = [
        {
          label: 'Cross Read Action',
          async action(context, data) {
            var doc = await context.util.models.request.getById(data.targetRequestId);
            var leaked = (doc && doc.body && doc.body.text) || 'NONE';
            await context.store.setItem('action_cross_read', leaked);
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

// The default (toggle-off) path routes through a separate, legacy, unprotected context builder —
// this fix only covers the sandboxed bridge.
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

const setBody = async (page: Page, text: string) => {
  await expect.soft(page.locator(BODY_CODE_MIRROR)).toBeVisible();
  await page.evaluate(
    ({ sel, value }) => {
      const node = document.querySelector(sel) as any;
      node?.CodeMirror?.setValue(value);
    },
    { sel: BODY_CODE_MIRROR, value: text },
  );
};

test('template tags, request hooks, and plugin actions all refuse to read a request that belongs to a different workspace', async ({
  page,
  app,
  dataPath,
  insomnia,
}) => {
  installProbePlugin(dataPath);
  await clearPluginToast(page);

  await insomnia.projectPage.importMultipleFixtures([
    'sandbox-ancestor-check-target.yaml',
    'sandbox-ancestor-check-probe.yaml',
  ]);
  await page.evaluate(() => (window as any).main.plugins.reloadPlugins());

  // Import assigns fresh ids, so a literal baked into the probe fixture would be stale — read the
  // real, post-import id back instead.
  const targetRequestId: string = await page.evaluate(async () => {
    const requests = await (window as any).database.invoke('find', 'Request', {});
    const target = requests.find((r: any) => r.name === 'target');
    if (!target) {
      throw new Error('target request not found after import');
    }
    return target._id;
  });
  const probeWorkspaceId: string = await page.evaluate(async () => {
    const workspaces = await (window as any).database.invoke('find', 'Workspace', {});
    const probe = workspaces.find((w: any) => w.name === 'Ancestor Check Probe Collection');
    if (!probe) {
      throw new Error('probe workspace not found after import');
    }
    return probe._id;
  });

  await insomnia.projectPage.navigateFromWorkspaceBreadcrumb();
  await insomnia.projectPage.workspaceList.openWorkspace('Ancestor Check Probe Collection');

  // Tag Probe: type a real `{% crossreadprobe %}` call referencing the target's real id, through the
  // real body editor.
  await insomnia.navigationSidebar.clickRequestOrFolder('Tag Probe');
  await page.getByText('Body', { exact: true }).click();
  await expect.soft(page.locator(BODY_CODE_MIRROR)).toContainText('PLACEHOLDER_TAG_TEXT');
  await setBody(page, `{% crossreadprobe '${targetRequestId}' %}`);
  await expect.soft(page.locator(BODY_CODE_MIRROR)).not.toContainText('PLACEHOLDER_TAG_TEXT');

  // Hook Probe: the request hook reads the target id straight out of the body text it's attached to.
  await insomnia.navigationSidebar.clickRequestOrFolder('Hook Probe');
  await page.getByText('Body', { exact: true }).click();
  await expect.soft(page.locator(BODY_CODE_MIRROR)).toContainText('PLACEHOLDER_BODY_TEXT');
  await setBody(page, targetRequestId);
  await expect.soft(page.locator(BODY_CODE_MIRROR)).not.toContainText('PLACEHOLDER_BODY_TEXT');
  // Wait for the debounced onChange to persist both edits before enabling the sandbox.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const requests = await (window as any).database.invoke('find', 'Request', {});
        return requests.find((r: any) => r.name === 'Hook Probe')?.body?.text;
      }),
    )
    .toBe(targetRequestId);

  await enableSandbox(page);

  const readTagPreview = async (tagPrefix: string): Promise<string> => {
    await page.locator(`[data-template^="${tagPrefix}"]`).click();
    const modal = page.getByRole('dialog');
    const preview = modal.getByLabel('Live Preview');
    await expect.soft(preview).not.toHaveValue('rendering...');
    const value = (await preview.inputValue()).trim();
    await modal.getByRole('button', { name: 'Done' }).click();
    await expect.soft(modal).toBeHidden();
    return value;
  };

  // --- Variant 1: template tag ---
  await insomnia.navigationSidebar.clickRequestOrFolder('Tag Probe');
  await page.getByText('Body', { exact: true }).click();
  await expect.poll(() => readTagPreview("{% crossreadprobe"), { timeout: 20_000 }).toBe('NONE');
  const tagFinal = await readTagPreview('{% crossreadprobe');
  expect.soft(tagFinal).not.toContain(TARGET_MARKER);

  // --- Variant 2: request hook (fires on Send; the echo server reflects request headers back) ---
  await insomnia.navigationSidebar.clickRequestOrFolder('Hook Probe');
  const responsePane = page.getByTestId('response-pane');
  await expect
    .poll(
      async () => {
        await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
        await expect.soft(page.getByRole('button', { name: 'Cancel Request' })).toBeHidden({ timeout: 30_000 });
        return (await responsePane.textContent()) || '';
      },
      { timeout: 25_000 },
    )
    .toContain('"x-cross-read": "NONE"');
  const hookFinal = (await responsePane.textContent()) || '';
  expect.soft(hookFinal).not.toContain(TARGET_MARKER);

  // --- Variant 3: plugin action (fired through the plugin bridge, the same call the request-actions
  // dropdown makes, including the workspaceId a dropdown would pass) ---
  await page.evaluate(
    ({ targetRequestId, workspaceId }) =>
      (window as any).main.plugins.executeAction({
        type: 'request',
        pluginName: 'insomnia-plugin-ancestor-check-probe',
        label: 'Cross Read Action',
        projectId: 'proj_ancestor_check_probe',
        domainData: { targetRequestId },
        workspaceId,
      }),
    { targetRequestId, workspaceId: probeWorkspaceId },
  );
  await insomnia.navigationSidebar.clickRequestOrFolder('Action Probe');
  await page.getByText('Body', { exact: true }).click();
  await expect.poll(() => readTagPreview('{% actionreadback'), { timeout: 20_000 }).toBe('NONE');
  const actionFinal = await readTagPreview('{% actionreadback');
  expect.soft(actionFinal).not.toContain(TARGET_MARKER);
});
