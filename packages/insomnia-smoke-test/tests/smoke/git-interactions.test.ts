import { test } from '../../playwright/test';

test('Git Interactions (clone, checkout branch, pull, push, stage changes, ...)', async ({ page }) => {
    const gitSyncSmokeTestToken = process.env.GIT_SYNC_SMOKE_TEST_TOKEN;
    test.setTimeout(600000);

    // read env variable to skip test
    if (!gitSyncSmokeTestToken) {
        console.log('Skipping, set GIT_SYNC_SMOKE_TEST_TOKEN to run, TIP: "gh auth login to get a token" and "export GIT_SYNC_SMOKE_TEST_TOKEN=$(gh auth token)"');
        test.skip();
        return;
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
    await page.getByTestId('git-dropdown').click();
    await page.getByText('Branches').click();
    await page.getByLabel('main').getByText('main').click();
    await page.getByText('abc').click();
    await page.getByLabel('abc').getByRole('button', { name: 'Fetch' }).click();
    await page.getByText('abc *').click();
    await page.getByRole('heading', { name: 'Branches', exact: true }).press('Escape');

    // perform some changes and commit them
    await page.locator('pre').filter({ hasText: 'title: Endpoint Security' }).click();
    await page.getByRole('textbox').fill(' test');
    // make sure the changes are stored
    await page.waitForTimeout(1000);
    await page.getByTestId('git-dropdown').click();
    await page.getByText('Commit').click();
    await page.getByRole('row', { name: 'spec.yaml' }).click();
    await page.locator('button[name="Stage all changes"]').click();
    await page.getByPlaceholder('This is a helpful message').click();
    await page.getByPlaceholder('This is a helpful message').fill('example commit message');
    await page.getByRole('button', { name: 'Commit', exact: true }).click();

    // switch back to main branch, which should not have said changes
    await page.getByTestId('git-dropdown').click();
    await page.getByText('main').click();
    await page.getByTestId('git-dropdown').click();
    await page.getByText('Branches').click();
    await page.getByText('main *').click();
    await page.getByText('main *').press('Escape');
    await page.getByTestId('CodeEditor').getByText('Endpoint Security').click();

    // switch to the branch with the changes and check if they are there
    await page.getByTestId('git-dropdown').click();
    await page.getByText('abc').click();
    await page.getByTestId('git-dropdown').click();
    await page.getByText('Branches').click();
    await page.getByText('abc *').click();
    await page.getByRole('heading', { name: 'Branches', exact: true }).press('Escape');
    await page.getByText('Endpoint Security test').click();

    // check git history
    await page.getByTestId('git-dropdown').click();
    await page.getByText('Fetch').click();

    await page.getByTestId('git-dropdown').click();
    await page.getByText('History').click();
    await page.getByRole('rowheader', { name: 'example commit message' }).click();
    await page.getByRole('gridcell', { name: 'just now' }).click();
    await page.getByRole('heading', { name: 'History', exact: true }).click();
    await page.getByRole('heading', { name: 'History', exact: true }).press('Escape');

    // push changes test
    await page.getByTestId('git-dropdown').click();
    await page.getByText('Branches').click();
    await page.getByLabel('push-pull-test').getByRole('button', { name: 'Fetch' }).click();
    await page.getByText('push-pull-test *').click();
    await page.getByText('push-pull-test *').press('Escape');
    await page.getByTestId('workspace-debug').click();
    await page.getByLabel('Create in collection').click();
    await page.getByLabel('New Folder').click();
    await page.getByLabel('Name', { exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill(`My Folder ${testUUID}`);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByTestId('git-dropdown').click();

    // Commit changes
    await page.getByText('Commit').click();
    await page.getByRole('row', { name: `My Folder ${testUUID}`, exact: true }).click();
    await page.locator('button[name="Stage all changes"]').click();
    await page.getByPlaceholder('This is a helpful message').click();
    await page.getByPlaceholder('This is a helpful message').fill(`commit test ${testUUID}`);
    await page.getByRole('button', { name: 'Commit', exact: true }).click();

    // Push changes
    await page.getByTestId('git-dropdown').click();
    await page.getByText('Push', { exact: true }).click();
    await page.getByTestId('git-dropdown').click();

    // Check if the changes are pushed
    await page.getByText('Fetch').click();
    await page.getByTestId('git-dropdown').click();
    await page.getByText('History').click();
    await page.getByRole('rowheader', { name: `commit test ${testUUID}` }).click();
    await page.getByRole('heading', { name: 'History', exact: true }).click();
    await page.getByRole('heading', { name: 'History', exact: true }).press('Escape');
});
