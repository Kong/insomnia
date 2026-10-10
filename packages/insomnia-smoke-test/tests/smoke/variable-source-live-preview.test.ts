import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

import type { InsomniaApp } from '../../playwright/pages';
import { test } from '../../playwright/test';

// Sends the current request and returns the requested field from the echoed request body,
// so tests can assert the value a variable actually renders at send time.
const sendAndGetVar = async (page: Page, field: string) => {
  await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
  await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200 OK');

  const rows = await page
    .getByTestId('response-pane')
    .getByTestId('CodeEditor')
    .locator('.CodeMirror-line')
    .allInnerTexts();
  const bodyJson = JSON.parse(rows.join(' '));
  const requestBody = JSON.parse(bodyJson.data);
  return requestBody[field];
};

// Activating an environment reaches the render context slightly late; poll until the
// freshly-active environment's value is the one actually rendered at send time.
const expectSentVar = async (page: Page, field: string, expected: string) => {
  await expect.poll(() => sendAndGetVar(page, field), { timeout: 30_000 }).toBe(expected);
};

async function selectEnvironment(page: Page, insomnia: InsomniaApp, scenario: (typeof SCENARIOS)[number]) {
  await page.getByLabel(scenario.environmentPickerLabel).click();
  await page.getByRole('option', { name: scenario.environment, exact: true }).click();
  // The popover stays open after selecting; dismiss it
  await page.locator('.app').press('Escape');
  // re-select the request so the request pane renders against the freshly-active environment
  await insomnia.navigationSidebar.clickRequestOrFolder(scenario.request);
}

async function openVariableModal(page: Page, templateSnippet: string) {
  const variableChip = page.locator(`[data-template*="${templateSnippet}"]`);
  await variableChip.waitFor({ state: 'visible' });
  await variableChip.click();

  const modal = page.getByRole('dialog');
  return {
    modal,
    sourceRow: modal.getByTestId('variable-source-row'),
    livePreview: modal.locator('textarea'),
  };
}

async function enableShowVariableSourceAndValue(page: Page) {
  await page.getByTestId('settings-button').click();
  const checkbox = page.getByRole('checkbox', { name: 'Show variable source and value' });
  await checkbox.click();
  await expect.soft(checkbox).toBeChecked();
  await page.locator('.app').press('Escape');
}

// One entry per variable source level. Every scenario is exercised against every
// surface: the send pipeline's resolved value, the live preview modal (Source +
// preview), the hover tooltip (value + source), and the inline display when
// "Show variable source and value" is enabled.
//
// openSurface drives how "Open" is asserted: collection environments open the
// workspace's Manage Environments modal with the env preselected; project
// environments open the environment workspace page with the env selected; folder
// sources open the folder pane with its Environment tab selected.
const SCENARIOS = [
  {
    id: 'collection base environment',
    request: 'cascade request no folder',
    environmentPickerLabel: 'Select an API Collection Environment',
    environment: 'Base Environment',
    field: 'cascadeVar',
    varSnippet: 'cascadeVar',
    chipName: '_.cascadeVar',
    value: 'fromBase',
    source: 'Base Environment',
    openSurface: 'environments-modal' as const,
    envPageRow: 'Base Environment',
    extraFixtures: [] as string[],
  },
  {
    id: 'collection sub environment overriding base',
    request: 'cascade request no folder',
    environmentPickerLabel: 'Select an API Collection Environment',
    environment: 'SubEnvA',
    field: 'cascadeVar',
    varSnippet: 'cascadeVar',
    chipName: '_.cascadeVar',
    value: 'fromSubA',
    source: 'SubEnvA (API Collection Sub-Environment)',
    openSurface: 'environments-modal' as const,
    envPageRow: 'SubEnvA',
    extraFixtures: [] as string[],
  },
  {
    id: 'folder environment winning over base/sub',
    request: 'cascade request',
    environmentPickerLabel: 'Select an API Collection Environment',
    environment: 'Base Environment',
    field: 'cascadeVar',
    varSnippet: 'cascadeVar',
    chipName: '_.cascadeVar',
    value: 'fromFolder',
    source: 'cascadeFolder',
    openSurface: 'folder-pane' as const,
    envPageRow: '',
    extraFixtures: [] as string[],
  },
  {
    id: 'nested folder environment overriding the outer folder',
    request: 'inner request',
    environmentPickerLabel: 'Select an API Collection Environment',
    environment: 'Base Environment',
    field: 'folderOverride',
    varSnippet: 'folderOverride',
    chipName: '_.folderOverride',
    value: 'fromInnerFolder',
    source: 'innerFolder',
    openSurface: 'folder-pane' as const,
    envPageRow: '',
    extraFixtures: [] as string[],
  },
  {
    id: 'project environment',
    request: 'Global Var Request',
    environmentPickerLabel: 'Select a Project Environment',
    environment: 'global-environment',
    field: 'global-base',
    varSnippet: 'global-base',
    chipName: "_['global-base']",
    value: '4444',
    source: 'Base Environment',
    openSurface: 'environment-page' as const,
    envPageRow: 'Base Environment',
    // The global environment lives in its own fixtures, imported on top of the
    // cascade collection from beforeEach.
    extraFixtures: ['collection-for-global-environments.yaml', 'global-environment.yaml'],
  },
];

const assertOpenLandedOnSourceEditor = async (page: Page, scenario: (typeof SCENARIOS)[number]) => {
  if (scenario.openSurface === 'environments-modal') {
    const modal = page.getByRole('dialog').filter({ hasText: 'Manage Environments' });
    await expect.soft(modal).toBeVisible();
    await expect
      .soft(page.getByRole('grid', { name: 'Environments' }).getByRole('row', { name: scenario.envPageRow }))
      .toHaveAttribute('aria-selected', 'true');
    return;
  }
  if (scenario.openSurface === 'environment-page') {
    await expect.soft(page).toHaveURL(/\/environment\?environmentId=/);
    await page.getByRole('row', { name: scenario.envPageRow }).waitFor({ state: 'visible' });
    return;
  }
  await expect.soft(page).toHaveURL(/debug\/request-group\//);
  await page
    .getByLabel('Insomnia Tabs')
    .getByLabel(`tab-${scenario.request}`, { exact: true })
    .waitFor({ state: 'visible' });
  await expect.soft(page.getByRole('tab', { name: 'Environment' })).toHaveAttribute('aria-selected', 'true');
};

// Fixture setup that varies per scenario; kept out of the test bodies to stay
// within the playwright/no-conditional-in-test lint rule.
const importScenarioFixtures = async (page: Page, insomnia: InsomniaApp, scenario: (typeof SCENARIOS)[number]) => {
  if (scenario.extraFixtures.length === 0) {
    return;
  }
  // The app is inside the beforeEach collection's workspace; return to the project
  // page first, as importMultipleFixtures expects.
  await page.getByTestId('workspace-breadcrumb-level-0').click();
  await insomnia.projectPage.importMultipleFixtures([...scenario.extraFixtures]);
};

test.describe('Variable source and live preview across environment levels', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test.beforeEach(async ({ app, page, insomnia }) => {
    await insomnia.projectPage.importFixture('environment-cascade-collection.yaml');
  });

  for (const scenario of SCENARIOS) {
    test(`${scenario.id}: send value, modal source and preview, and navigation`, async ({ page, insomnia }) => {
      await importScenarioFixtures(page, insomnia, scenario);

      await insomnia.navigationSidebar.clickRequestOrFolder(scenario.request);
      await selectEnvironment(page, insomnia, scenario);

      // The value the send pipeline actually resolves
      await expectSentVar(page, scenario.field, scenario.value);

      await page.getByText('Body', { exact: true }).click();
      const { sourceRow, livePreview } = await openVariableModal(page, scenario.varSnippet);
      await expect.soft(sourceRow).toContainText(scenario.source);
      // The live preview must resolve to the same value the source implies
      await expect.soft(livePreview).toHaveValue(scenario.value, { timeout: 15_000 });

      await sourceRow.getByTestId('variable-source-open').click();
      await assertOpenLandedOnSourceEditor(page, scenario);
    });

    test(`${scenario.id}: hover tooltip shows value and source`, async ({ page, insomnia }) => {
      await importScenarioFixtures(page, insomnia, scenario);

      await insomnia.navigationSidebar.clickRequestOrFolder(scenario.request);
      await selectEnvironment(page, insomnia, scenario);
      await page.getByText('Body', { exact: true }).click();

      const variableChip = page.locator(`[data-template*="${scenario.varSnippet}"]`);
      await variableChip.waitFor({ state: 'visible' });
      await variableChip.hover();

      const tooltip = page.getByTestId('variable-source-tooltip');
      await expect.soft(tooltip).toBeVisible();
      await expect.soft(tooltip).toContainText(scenario.value);
      await expect.soft(tooltip).toContainText(scenario.source);
      // The chip keeps showing the short variable name while hovered
      await expect.soft(variableChip).toHaveText(scenario.chipName);
    });

    test(`${scenario.id}: show variable source and value renders the source inline`, async ({ page, insomnia }) => {
      await importScenarioFixtures(page, insomnia, scenario);

      await insomnia.navigationSidebar.clickRequestOrFolder(scenario.request);
      await selectEnvironment(page, insomnia, scenario);
      await page.getByText('Body', { exact: true }).click();

      await enableShowVariableSourceAndValue(page);

      // The chip itself now shows the value and its source
      const variableChip = page.locator(`[data-template*="${scenario.varSnippet}"]`);
      await expect.soft(variableChip).toHaveText(`${scenario.value} {${scenario.source}}`);

      // With the source inline, no interactive tooltip appears on hover — poll past
      // the tooltip dwell delay (400ms) and assert it never showed up.
      await variableChip.hover();
      await expect.poll(async () => page.getByTestId('variable-source-tooltip').count(), { timeout: 1000 }).toBe(0);
    });
  }

  test('hovering an undefined variable shows the render error instead of vanishing', async ({ page, insomnia }) => {
    // The global env is NOT activated here, so 'New Request' has neighboring
    // defined chips (exampleString -> collection base env) and error chips
    // (global-base / global-sub are undefined).
    await page.getByTestId('workspace-breadcrumb-level-0').click();
    await insomnia.projectPage.importFixture('collection-for-global-environments.yaml');

    await insomnia.navigationSidebar.clickRequestOrFolder('New Request');
    await page.getByText('Body', { exact: true }).click();

    // Hover a defined chip first: value + source (ExampleA is active after import)
    const definedChip = page.locator('[data-template*="exampleString"]');
    await definedChip.waitFor({ state: 'visible' });
    await definedChip.hover();
    const tooltip = page.getByTestId('variable-source-tooltip');
    await expect.soft(tooltip).toContainText('subenvA0');

    // Moving onto an undefined chip swaps the tooltip to the render error
    // instead of making it vanish
    const errorChip = page.locator('[data-template*="global-base"]');
    await errorChip.hover();
    await expect.soft(tooltip).toContainText('Failed to render environment variables');
  });

  test('hovering the tooltip content keeps it visible', async ({ page, insomnia }) => {
    const requestName = 'cascade request no folder';
    await insomnia.navigationSidebar.clickRequestOrFolder(requestName);
    await selectEnvironment(page, insomnia, SCENARIOS[0]);
    await page.getByText('Body', { exact: true }).click();

    const variableChip = page.locator('[data-template*="cascadeVar"]');
    await variableChip.waitFor({ state: 'visible' });
    await variableChip.hover();

    const tooltip = page.getByTestId('variable-source-tooltip');
    await expect.soft(tooltip).toBeVisible();

    // Hover the tooltip's own content (the value area); it must stay visible
    // past the 350ms grace period instead of hiding.
    await tooltip.hover();
    const hoverStartedAt = Date.now();
    await expect.poll(() => Date.now() - hoverStartedAt >= 700, { timeout: 1000, intervals: [250] }).toBe(true);
    await expect.soft(tooltip).toBeVisible();
  });
});
