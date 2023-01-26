import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('Environment Editor', async () => {

  test.beforeEach(async ({ app, page }) => {
    await page.getByTestId('project').click();
    await page.getByRole('button', { name: 'Create' }).click();
    const text = await loadFixture('environments.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);
    await page.getByRole('menuitem', { name: 'Clipboard' }).click();
    await page.click('text=Collectionenvironmentsjust now');
  });

  test('create a new environment', async ({ page }) => {
    // Create the environment
    await page.getByText('ExampleB').click();
    await page.getByRole('menuitem', { name: 'Manage Environments' }).click();
    await page.getByTestId('CreateEnvironmentDropdown').click();
    await page.getByRole('menuitem', { name: 'Environment', exact: true }).click();
    await page.getByRole('button', { name: 'New Environment' }).click();
    await page.getByRole('button', { name: 'Close' }).click();

    // Make it active one
    await page.getByText('ExampleB').click();
    await page.getByRole('menuitem', { name: 'New Environment' }).click();

    // Send a request check variables defaulted to base env since new env is empty
    await page.getByRole('button', { name: 'GET New Request' }).click();
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('tab', { name: 'Timeline' }).click();
    await page.getByText('baseenv0').click();
    await page.getByText('baseenv1').click();
  });

  // rename an existing environment
  test('Rename an existing environment', async ({ page }) => {
    // Rename the environment
    await page.getByText('ExampleB').click();
    await page.getByRole('menuitem', { name: 'Manage Environments' }).click();
    await page.getByRole('button', { name: 'ExampleA' }).click();
    await page.getByTitle('Click to edit', { exact: true }).click();
    await page.getByRole('dialog').locator('input[type="text"]').fill('Gandalf');
    await page.getByRole('button', { name: 'Close' }).click();

    // Make it active one
    await page.getByText('ExampleB').click();
    await page.getByRole('menuitem', { name: 'Gandalf' }).click();

    // Send a request check variables defaulted to base env since new env is empty
    await page.getByRole('button', { name: 'GET New Request' }).click();
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('tab', { name: 'Timeline' }).click();
    await page.getByText('subenvA0').click();
    await page.getByText('subenvA1').click();
  });

  test('Add new variables to an existing environment', async ({ page }) => {
    // Rename the environment
    await page.getByText('ExampleB').click();
    await page.getByRole('menuitem', { name: 'Manage Environments' }).click();

    // add a new string environment variable
    await page.locator('pre').filter({ hasText: '"exampleNumber": 2222,' }).click();
    await page.getByTestId('CodeEditor').getByRole('textbox').press('Enter');
    await page.getByTestId('CodeEditor').getByRole('textbox').fill('"testNumber":9000,');
    await page.getByTestId('CodeEditor').getByRole('textbox').press('Enter');
    await page.getByTestId('CodeEditor').getByRole('textbox').fill('"testString":"Gandalf",');
    await page.getByTestId('CodeEditor').getByRole('textbox').press('Enter');

    // Open request
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'GET New Request' }).click();

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
    await page.locator('pre').filter({ hasText: '| 9000' }).click();
    await page.locator('pre').filter({ hasText: '| Gandalf' }).click();

  });
});
