import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Environment Editor', async () => {

  test.beforeEach(async ({ app, page }) => {
    await page.getByRole('button', { name: 'Create in project' }).click();
    const text = await loadFixture('environments.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.getByRole('menuitemradio', { name: 'Import' }).click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await page.getByText('Collectionenvironments').click();
  });

  test('create a new environment', async ({ page }) => {
    // Create the environment (which will become active on creation)
    // await page.getByLabel("Select an environment").click();
    await page.getByLabel('Manage Environments').click();
    await page.getByTestId('CreateEnvironmentDropdown').click();
    await page.getByRole('menuitem', { name: 'Environment', exact: true }).click();
    await page.getByRole('option', { name: 'New Environment' }).click();
    await page.getByRole('button', { name: 'Close' }).click();

    // Send a request check variables defaulted to base env since new env is empty
    await page.getByLabel('Request Collection').getByRole('row', { name: 'New Request' }).click();
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('tab', { name: 'Timeline' }).click();
    await page.getByText('baseenv0').click();
    await page.getByText('baseenv1').click();
  });

  // rename an existing environment
  test('Rename an existing environment', async ({ page }) => {
    // Rename the environment (which will make it active)
    await page.getByLabel('Manage Environments').click();
    await page.getByRole('option', { name: 'ExampleB' }).click();
    await page.getByTitle('Click to edit', { exact: true }).click();
    await page.getByRole('dialog').locator('input[type="text"]').fill('Gandalf');
    await page.getByRole('button', { name: 'Close' }).click();

    // Send a request check variables defaulted to base env since new env is empty
    await page.getByLabel('Request Collection').getByRole('row', { name: 'New Request' }).click();
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('tab', { name: 'Timeline' }).click();
    await page.getByText('subenvB0').click();
    await page.getByText('subenvB1').click();
  });

  test('Add new variables to an existing environment', async ({ page }) => {
    // Rename the environment
    await page.getByLabel('Manage Environments').click();
    // add a new string environment variable
    await page.locator('pre').filter({ hasText: '"exampleNumber": 1111,' }).click();
    await page.getByTestId('CodeEditor').getByRole('textbox').press('Enter');
    await page.getByTestId('CodeEditor').getByRole('textbox').fill('"testNumber":9000,');
    await page.getByTestId('CodeEditor').getByRole('textbox').press('Enter');
    await page.getByTestId('CodeEditor').getByRole('textbox').fill('"testString":"Gandalf",');
    await page.getByTestId('CodeEditor').getByRole('textbox').press('Enter');

    // Open request
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByLabel('Request Collection').getByRole('row', { name: 'New Request' }).click();

    // Add number variable to request body
    await page.locator('pre').filter({ hasText: '_.exampleObject.anotherNumber' }).click();
    await page.getByTestId('CodeEditor').getByRole('textbox').press('Enter');
    await page.getByTestId('CodeEditor').getByRole('textbox').press('Control+ ');
    await page.getByText('_.testNumber').click();

    // Add string variable to request body
    await page.getByTestId('CodeEditor').getByRole('textbox').press('Enter');
    await page.getByTestId('CodeEditor').getByRole('textbox').press('Control+ ');
    await page.getByText('_.testString').click();
    await page.getByTestId('CodeEditor').getByRole('textbox').press('Enter');

    // TODO(filipe) add an environment variable that returns value of a nunjucks template (e.g. timestamp)

    // Check new variables are in the timeline
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('tab', { name: 'Timeline' }).click();

    // FIXME(filipe) - adding variables to request body can be so fast they don't get picked up when sending request

    // await page.locator('pre').filter({ hasText: '| 9000' }).click();

    // NOTE - Test fails due to actual bug - the variables are not being added to the request body when the request is sent
    // await page.locator('pre').filter({ hasText: '| Gandalf' }).click();

  });
});
