import type { Locator, Page } from '@playwright/test';
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

type EnvironmentScenario = Pick<
  (typeof SCENARIOS)[number],
  'environmentPickerLabel' | 'environment' | 'request'
>;

async function selectEnvironment(page: Page, insomnia: InsomniaApp, scenario: EnvironmentScenario) {
  await page.getByLabel(scenario.environmentPickerLabel).click();
  await page.getByRole('option', { name: scenario.environment, exact: true }).click();
  // The popover stays open after selecting; dismiss it
  await page.locator('.app').press('Escape');
  // re-select the request so the request pane renders against the freshly-active environment
  await insomnia.navigationSidebar.clickRequestOrFolder(scenario.request);
}

async function openManageEnvironmentsModal(page: Page) {
  await page.getByLabel('Select an API Collection Environment').click();
  await page.getByRole('button', { name: 'Manage API collection environments' }).click();
  return page.getByRole('dialog', { name: 'Manage Environments' });
}

// The tag mark can be rebuilt right after the editor mounts, which silently drops
// the pointer if it was already resting on the old node. Re-enter it until the
// tooltip appears.
async function hoverVariableChip(page: Page, chip: Locator) {
  const tooltip = page.getByTestId('variable-source-tooltip');
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.mouse.move(0, 0);
    await chip.hover();
    try {
      // Waits out the dwell delay and the async render.
      await tooltip.waitFor({ state: 'visible', timeout: 1500 });
      return tooltip;
    } catch {
      // The mark may have been rebuilt under the pointer; hover it again.
    }
  }
  await expect.soft(tooltip).toBeVisible();
  return tooltip;
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
  const checkbox = page.getByRole('checkbox', { name: 'Template tags show variable source and value' });
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
    source: 'Collection Environment : Base Environment',
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
    source: 'Collection Environment : SubEnvA',
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
    source: 'Folder Environment : cascadeFolder',
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
    source: 'Folder Environment : innerFolder',
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
    source: 'Project Environment : Base Environment',
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
    // The ?environmentId= deep link is consumed after applying, so assert the final
    // URL and the preselected row.
    await expect.soft(page).toHaveURL(/\/environment\/?$/);
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
      const tooltip = await hoverVariableChip(page, variableChip);
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

      // With the source inline, no interactive tooltip appears on hover — outlast
      // the tooltip dwell delay (400ms), then assert it never showed up. While the
      // chip stays hovered a shown tooltip would remain visible, so one post-dwell
      // observation is enough.
      await variableChip.hover();
      const hoverStartedAt = Date.now();
      await expect
        .poll(
          async () =>
            Date.now() - hoverStartedAt >= 700 && (await page.getByTestId('variable-source-tooltip').count()) === 0,
          {
            timeout: 2000,
            intervals: [250],
          },
        )
        .toBe(true);
    });
  }

  test('modal source follows the edited template and hides for non-variable content', async ({ page, insomnia }) => {
    // This scenario's variable comes from the folder environment, while subOnlyVar
    // comes from the collection environment: switching between them changes the source.
    const folderScenario = SCENARIOS[2];
    await insomnia.navigationSidebar.clickRequestOrFolder(folderScenario.request);
    await selectEnvironment(page, insomnia, folderScenario);
    await page.getByText('Body', { exact: true }).click();

    const { modal, sourceRow, livePreview } = await openVariableModal(page, folderScenario.varSnippet);
    await expect.soft(sourceRow).toContainText(folderScenario.source);
    await expect.soft(livePreview).toHaveValue(folderScenario.value, { timeout: 15_000 });

    // Switching the selected variable moves both the preview and the source.
    const environmentVariable = modal.getByLabel('Environment Variable');
    await environmentVariable.selectOption('{{ _.subOnlyVar }}');
    await expect.soft(sourceRow).toContainText('Collection Environment : Base Environment');
    await expect.soft(livePreview).toHaveValue('subOnly_base', { timeout: 15_000 });

    // Editing a custom template re-derives the source on every change. Extra spaces
    // keep the custom input mounted, so this exercises editing rather than a switch.
    await environmentVariable.selectOption({ label: '-- Custom --' });
    const customTemplate = modal.locator('input[type="text"]');
    await customTemplate.fill('plain text');
    await expect.soft(livePreview).toHaveValue('plain text');
    await expect.soft(sourceRow).toBeHidden();

    // Inherited Object.prototype keys are not variables: no Source row.
    await customTemplate.fill('{{ constructor }}');
    await expect.soft(sourceRow).toBeHidden();

    await customTemplate.fill('{{  _.subOnlyVar  }}');
    await expect.soft(sourceRow).toContainText('Collection Environment : Base Environment');

    // Open must use the freshly derived source, not the one captured when the modal opened.
    await sourceRow.getByTestId('variable-source-open').click();
    const environmentsModal = page.getByRole('dialog').filter({ hasText: 'Manage Environments' });
    await expect.soft(environmentsModal).toBeVisible();
    await expect
      .soft(page.getByRole('grid', { name: 'Environments' }).getByRole('row', { name: 'Base Environment' }))
      .toHaveAttribute('aria-selected', 'true');
  });

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

  test('project environment page attributes its own environments to the project', async ({ page, insomnia }) => {
    // The environment page renders against the project environment workspace itself,
    // so its base and sub environments must still read as project environments.
    await page.getByTestId('workspace-breadcrumb-level-0').click();
    await insomnia.projectPage.importFixture('project-environment-source.yaml');
    await insomnia.navigationSidebar.selectWorkspace('project-environment-source');
    await page.getByLabel('Environments', { exact: true }).getByText('Source Sub Environment').click();

    const { sourceRow, livePreview } = await openVariableModal(page, 'text_base');
    await expect.soft(sourceRow).toContainText('Project Environment : Base Environment');
    await expect.soft(livePreview).toHaveValue('fromProjectBase', { timeout: 15_000 });
  });

  test('tooltip Open is clickable inside the Manage Environments modal', async ({ page, insomnia }) => {
    const requestName = 'cascade request no folder';
    await insomnia.navigationSidebar.clickRequestOrFolder(requestName);
    await selectEnvironment(page, insomnia, SCENARIOS[1]);
    await page.getByText('Body', { exact: true }).click();

    const environmentsDialog = await openManageEnvironmentsModal(page);
    const environmentsGrid = page.getByRole('grid', { name: 'Environments' });
    await expect.soft(environmentsGrid.getByRole('row', { name: 'SubEnvA' })).toHaveAttribute('aria-selected', 'true');

    // SubEnvA's baseSourcedVar is a tag sourced from the base environment; the tooltip
    // is portalled outside the modal, where an open modal marks it inert.
    const variableChip = environmentsDialog.locator('[data-template*="baseOnlyVar"]');
    await variableChip.waitFor({ state: 'visible' });
    const tooltip = await hoverVariableChip(page, variableChip);
    await expect.soft(tooltip).toContainText('baseOnlyValue');

    await tooltip.getByTestId('variable-source-tooltip-open').click();
    await expect
      .soft(environmentsGrid.getByRole('row', { name: 'Base Environment' }))
      .toHaveAttribute('aria-selected', 'true');
    // Opening a collection source keeps the dialog mounted and selects the source
    // environment; it must not stack a second dialog on top.
    await expect.soft(page.getByRole('dialog', { name: 'Manage Environments' })).toHaveCount(1);

    // Selecting another environment must not make a later Open for the same source
    // a no-op: the request has to be applied again.
    await environmentsGrid.getByRole('row', { name: 'SubEnvA' }).click();
    await hoverVariableChip(page, variableChip);
    await tooltip.getByTestId('variable-source-tooltip-open').click();
    await expect
      .soft(environmentsGrid.getByRole('row', { name: 'Base Environment' }))
      .toHaveAttribute('aria-selected', 'true');
  });

  test('tooltip Open closes the modal when it navigates to the source surface', async ({ page, insomnia }) => {
    // This request lives in cascadeFolder, whose environment supplies folderOverride:
    // the chip in SubEnvA's value resolves to the folder environment, so Open navigates
    // to the folder pane instead of switching the modal's selection.
    const folderScenario = SCENARIOS[2];
    await insomnia.navigationSidebar.clickRequestOrFolder(folderScenario.request);
    await selectEnvironment(page, insomnia, {
      environmentPickerLabel: folderScenario.environmentPickerLabel,
      environment: 'SubEnvA',
      request: folderScenario.request,
    });
    await page.getByText('Body', { exact: true }).click();

    const environmentsDialog = await openManageEnvironmentsModal(page);
    const variableChip = environmentsDialog.locator('[data-template*="folderOverride"]');
    await variableChip.waitFor({ state: 'visible' });
    const tooltip = await hoverVariableChip(page, variableChip);
    await expect.soft(tooltip).toContainText('Folder Environment : cascadeFolder');
    await tooltip.getByTestId('variable-source-tooltip-open').click();

    await expect.soft(page).toHaveURL(/debug\/request-group\//);
    await expect.soft(page.getByRole('tab', { name: 'Environment' })).toHaveAttribute('aria-selected', 'true');
    await expect.soft(environmentsDialog).toBeHidden();
  });

  test('tooltip Open closes the modal when only the search changes', async ({ page, insomnia }) => {
    // Open the folder pane itself, so navigating to its environment tab keeps the
    // pathname and only swaps the search string.
    const folderScenario = SCENARIOS[2];
    await selectEnvironment(page, insomnia, {
      environmentPickerLabel: folderScenario.environmentPickerLabel,
      environment: 'SubEnvA',
      request: 'cascadeFolder',
    });

    const environmentsDialog = await openManageEnvironmentsModal(page);
    const variableChip = environmentsDialog.locator('[data-template*="folderOverride"]');
    await variableChip.waitFor({ state: 'visible' });
    const tooltip = await hoverVariableChip(page, variableChip);
    await expect.soft(tooltip).toContainText('Folder Environment : cascadeFolder');
    await tooltip.getByTestId('variable-source-tooltip-open').click();

    await expect.soft(page).toHaveURL(/debug\/request-group\//);
    await expect.soft(page.getByRole('tab', { name: 'Environment' })).toHaveAttribute('aria-selected', 'true');
    await expect.soft(environmentsDialog).toBeHidden();
  });

  test('tooltip Open navigates to a project environment source', async ({ page, insomnia }) => {
    const projectScenario = SCENARIOS[4];
    await importScenarioFixtures(page, insomnia, projectScenario);
    await insomnia.navigationSidebar.clickRequestOrFolder(projectScenario.request);
    await selectEnvironment(page, insomnia, projectScenario);
    await page.getByText('Body', { exact: true }).click();

    const environmentsDialog = await openManageEnvironmentsModal(page);
    const environmentsGrid = page.getByRole('grid', { name: 'Environments' });
    await environmentsDialog.getByRole('row', { name: 'ExampleA' }).click();
    const variableChip = environmentsDialog.locator('[data-template*="global-base"]');
    await variableChip.waitFor({ state: 'visible' });
    const tooltip = await hoverVariableChip(page, variableChip);
    await expect.soft(tooltip).toContainText('Project Environment : Base Environment');
    await tooltip.getByTestId('variable-source-tooltip-open').click();

    await expect.soft(page).toHaveURL(/\/environment/);
    await expect.soft(environmentsDialog).toBeHidden();
    await expect
      .soft(environmentsGrid.getByRole('row', { name: 'Base Environment' }))
      .toHaveAttribute('aria-selected', 'true');
  });

  test('tooltip Open selects the source environment on the project environment page', async ({ page, insomnia }) => {
    await page.getByTestId('workspace-breadcrumb-level-0').click();
    await insomnia.projectPage.importMultipleFixtures(['global-environment.yaml']);
    await page.getByLabel('Files').getByLabel('global-environment').click();

    const environmentsGrid = page.getByRole('grid', { name: 'Environments' });
    await environmentsGrid.getByRole('row', { name: 'New Environment' }).click();

    const variableChip = page.locator('[data-template*="global-base"]');
    await variableChip.waitFor({ state: 'visible' });
    const tooltip = await hoverVariableChip(page, variableChip);
    await tooltip.getByTestId('variable-source-tooltip-open').click();

    await expect
      .soft(environmentsGrid.getByRole('row', { name: 'Base Environment' }))
      .toHaveAttribute('aria-selected', 'true');
  });

  test('tooltip Open from the request body navigates to a project environment source', async ({ page, insomnia }) => {
    const projectScenario = SCENARIOS[4];
    await importScenarioFixtures(page, insomnia, projectScenario);
    await insomnia.navigationSidebar.clickRequestOrFolder(projectScenario.request);
    await selectEnvironment(page, insomnia, projectScenario);
    await page.getByText('Body', { exact: true }).click();

    const variableChip = page.locator('[data-template*="global-base"]');
    await variableChip.waitFor({ state: 'visible' });
    const tooltip = await hoverVariableChip(page, variableChip);
    await expect.soft(tooltip).toContainText('Project Environment : Base Environment');
    await tooltip.getByTestId('variable-source-tooltip-open').click();

    await expect.soft(page).toHaveURL(/\/environment/);
    await expect
      .soft(page.getByRole('grid', { name: 'Environments' }).getByRole('row', { name: 'Base Environment' }))
      .toHaveAttribute('aria-selected', 'true');
  });

  test('tooltip Open closes the modal on the project environment page', async ({ page, insomnia }) => {
    // The environment page hides the picker, so its editor opens with the shortcut.
    await page.getByTestId('workspace-breadcrumb-level-0').click();
    await insomnia.projectPage.importMultipleFixtures(['global-environment.yaml']);
    await page.getByLabel('Files').getByLabel('global-environment').click();
    const pageEnvironments = page.getByRole('grid', { name: 'Environments' });
    await pageEnvironments.waitFor({ state: 'visible' });

    await page.locator('.app').press('ControlOrMeta+e');
    const environmentsDialog = page.getByRole('dialog', { name: 'Manage Environments' });
    await environmentsDialog.waitFor({ state: 'visible' });
    await environmentsDialog.getByRole('row', { name: 'New Environment' }).click();
    const variableChip = environmentsDialog.locator('[data-template*="global-base"]');
    await variableChip.waitFor({ state: 'visible' });
    const tooltip = await hoverVariableChip(page, variableChip);
    await tooltip.getByTestId('variable-source-tooltip-open').click();

    await expect.soft(environmentsDialog).toBeHidden();
    await expect
      .soft(page.getByRole('grid', { name: 'Environments' }).getByRole('row', { name: 'Base Environment' }))
      .toHaveAttribute('aria-selected', 'true');
  });
});
