import { test } from '../../playwright/test';

test('Git Interactions (clone, checkout branch, pull, push, stage changes, ...)', async ({ page }) => {

    let gitSyncSmokeTestToken = process.env.GIT_SYNC_SMOKE_TEST_TOKEN;

    // read env variable to skip test
    if (!gitSyncSmokeTestToken) {
        test.skip();
    }

    // generate a uuid string
    const testUUID = crypto.randomUUID();

    // git clone
    await page.waitForSelector('[data-test-git-enable="true"]');
    await page.getByLabel('Clone git repository').click();
    await page.getByRole('tab', { name: ' Git' }).click();
    await page.getByPlaceholder('https://github.com/org/repo.git').fill('https://github.com/Kong/insomnia-git-example.git');
    await page.getByPlaceholder('Name').fill('Test User');
    await page.getByPlaceholder('Email').fill('test@test.com');
    await page.getByPlaceholder('MyUser').fill('test');
    await page.getByPlaceholder('88e7ee63b254e4b0bf047559eafe86ba9dd49507').fill(gitSyncSmokeTestToken);
    await page.getByTestId('git-repository-settings-modal__sync-btn').click();
    await page.getByLabel('Toggle preview').click();

    // switch branches
    await page.getByTestId('git-dropdown').getByLabel('Git Sync').click();
    await page.getByRole('button', { name: ' Branches' }).click();
    await page.getByRole('cell', { name: 'main(current)' }).click();
    await page.getByRole('cell', { name: 'abc' }).click();
    await page.getByRole('row', { name: 'abc Checkout' }).getByRole('button').click();
    await page.getByRole('cell', { name: 'abc(current)' }).click();
    await page.getByRole('button', { name: 'Done' }).click();

    // perform some changes and commit them
    await page.locator('pre').filter({ hasText: 'title: Endpoint Security' }).click();
    await page.getByRole('textbox').fill(' test');
    await page.getByTestId('git-dropdown').getByLabel('Git Sync').click();
    await page.getByRole('button', { name: ' Commit' }).click();
    await page.getByText('Modified Objects').click();
    await page.getByText('ApiSpec').click();
    await page.getByPlaceholder('A descriptive message to').click();
    await page.getByPlaceholder('A descriptive message to').fill('example commit message');
    await page.getByRole('dialog').getByText('abc').click();
    await page.getByRole('button', { name: ' Commit' }).click();
    await page.getByText('No changes to commit.').click();
    await page.getByRole('button', { name: 'Close' }).click();

    // switch back to main branch, which should not have said changes
    await page.getByTestId('git-dropdown').getByLabel('Git Sync').click();
    await page.getByRole('button', { name: 'main' }).click();
    await page.getByTestId('git-dropdown').getByLabel('Git Sync').click();
    await page.getByRole('button', { name: ' Branches' }).click();
    await page.getByRole('cell', { name: 'main(current)' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByTestId('CodeEditor').getByText('Endpoint Security').click();

    // switch to the branch with the changes and check if they are there
    await page.getByTestId('git-dropdown').getByLabel('Git Sync').click();
    await page.getByRole('button', { name: 'abc' }).click();
    await page.getByTestId('git-dropdown').getByLabel('Git Sync').click();
    await page.getByRole('button', { name: ' Branches' }).click();
    await page.getByRole('cell', { name: 'abc(current)' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByText('Endpoint Security test').click();

    // check git history
    await page.getByTestId('git-dropdown').getByLabel('Git Sync').click();
    await page.getByRole('button', { name: ' Fetch' }).click();
    await page.getByTestId('git-dropdown').getByLabel('Git Sync').click();
    await page.getByRole('button', { name: ' History' }).click();
    await page.getByRole('cell', { name: 'example commit message' }).click();
    await page.getByRole('cell', { name: 'just now' }).click();
    await page.getByRole('button', { name: 'Done' }).click();

    // push changes test
    await page.getByTestId('git-dropdown').getByLabel('Git Sync').click();
    await page.getByRole('button', { name: ' Branches' }).click();
    await page.getByRole('cell', { name: 'abc(current)' }).click();
    await page.getByRole('cell', { name: 'push-pull-test' }).click();
    await page.getByRole('row', { name: 'push-pull-test Checkout' }).getByRole('button').click();
    await page.getByRole('cell', { name: 'push-pull-test(current)' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByTestId('workspace-debug').click();
    await page.getByLabel('Create in collection').click();
    await page.getByLabel('New Folder').click();
    await page.getByLabel('Name', { exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill(`My Folder ${testUUID}`);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByTestId('git-dropdown').getByLabel('Git Sync').click();
    await page.getByRole('button', { name: ' Commit' }).click();
    await page.getByRole('cell', { name: `My Folder ${testUUID}` }).locator('label').click();
    await page.getByPlaceholder('A descriptive message to').click();
    await page.getByPlaceholder('A descriptive message to').fill(`commit test ${testUUID}`);
    await page.getByText('Commit Changes').click();
    await page.getByRole('button', { name: ' Commit' }).click();
    await page.getByText('No changes to commit.').click();
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByTestId('git-dropdown').getByLabel('Git Sync').click();
    await page.getByRole('button', { name: ' Push' }).click();
    await page.getByTestId('git-dropdown').getByLabel('Git Sync').click();
    await page.getByRole('button', { name: ' Fetch' }).click();
    await page.getByTestId('git-dropdown').getByLabel('Git Sync').click();
    await page.getByRole('button', { name: ' History' }).click();
    await page.getByRole('cell', { name: `commit test ${testUUID}` }).click();
    await page.getByRole('button', { name: 'Done' }).click();

});
