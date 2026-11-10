import { expect } from '@playwright/test';

import { test } from '../../playwright/test';

const LONG_NAME = 'Staging environment with a name that never fits the header trigger';

const collectionYaml = () => {
  const subEnvironments = Array.from({ length: 40 }, (_, index) => {
    const name = index === 39 ? LONG_NAME : `Environment ${index + 1}`;
    const id = `env_${(index + 0x10).toString(16).padStart(32, '0')}`;
    return `    - name: ${name}
      meta:
        id: ${id}
        created: 1670587812382
        modified: 1670587818649
        isPrivate: false
      data:
        value: ${index}`;
  }).join('\n');

  return `type: collection.insomnia.rest/5.0
schema_version: "5.1"
name: environment-picker-overflow
meta:
  id: wrk_00000000000000000000000000000001
  created: 1670587793246
  modified: 1670587793246
collection:
  - url: localhost:4010/
    name: New Request
    meta:
      id: req_00000000000000000000000000000001
      created: 1670587797191
      modified: 1670587797191
      isPrivate: false
    method: GET
environments:
  name: Base Environment
  meta:
    id: env_ffffffffffffffffffffffffffffffff
    created: 1670587793246
    modified: 1670587793246
    isPrivate: false
  data:
    value: base
  subEnvironments:
${subEnvironments}
`;
};

test.describe('environment picker overflow', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test('keeps the list scroll position and shows the full name with the scope hint', async ({ app, page }) => {
    const text = collectionYaml();
    await app.evaluate(async ({ clipboard }, value) => clipboard.writeText(value), text);

    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });

    const trigger = page.getByLabel('Select an API Collection Environment');
    await trigger.click();

    const listbox = page.getByRole('listbox', { name: 'Select an API Collection Environment' });
    await listbox.waitFor();
    await listbox.evaluate(element => {
      element.scrollTop = element.scrollHeight;
    });

    const longNameOption = page.getByRole('option', { name: LONG_NAME, exact: true });
    await longNameOption.click();
    await expect.soft(longNameOption).toHaveAttribute('aria-selected', 'true');

    // Selecting an environment revalidates the workspace loader; the list must stay mounted and
    // keep the position the user scrolled to.
    const scrollTop = await listbox.evaluate(element => element.scrollTop);
    expect.soft(scrollTop).toBeGreaterThan(0);

    // The popover renders a modal underlay, so the trigger cannot be hovered until it closes.
    await page.keyboard.press('Escape');
    await expect.soft(listbox).toBeHidden();

    await trigger.locator('.tooltip').hover();
    await expect.soft(page.getByRole('tooltip')).toContainText(LONG_NAME);
    await expect
      .soft(page.getByRole('tooltip'))
      .toContainText('Collection environment — used only by this API collection.');
  });
});
