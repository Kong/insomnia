import { test } from '../playwright/test';

test('Git Sync', async ({ page, gitServer }) => {
  // Set up Git Sync
  await page.click('text=Setup Git Sync');

  await page.click('button:has-text("Repository Settings")');

  await page.fill(
    '[placeholder="https://github.com/org/repo.git"]',
    `${gitServer.url}/example.git`
  );

  await page.press('[placeholder="https://github.com/org/repo.git"]', 'Tab');

  await page.fill('[placeholder="Name"]', 'sleepyhead');

  await page.press('[placeholder="Name"]', 'Tab');

  await page.fill('[placeholder="Email"]', 'sleepyhead@konghq.com');

  await page.press('[placeholder="Email"]', 'Tab');

  await page.fill('[placeholder="MyUser"]', 'sleepyhead');

  await page.press('[placeholder="MyUser"]', 'Tab');

  await page.fill(
    '[placeholder="88e7ee63b254e4b0bf047559eafe86ba9dd49507"]',
    'supersecrettoken'
  );

  await page.press(
    '[placeholder="88e7ee63b254e4b0bf047559eafe86ba9dd49507"]',
    'Tab'
  );

  await page.press('text=Done', 'Enter');

  // Create a new commit
  await page.click('button:has-text("master")');

  await page.click('button:has-text("Commit")');

  await page.fill('textarea[name="commit-message"]', 'Initial commit');

  await page.check('input[name="select-all"]');

  await page.click('button:has-text("Commit")');

  // Push the new commit to the remote
  await page.click('button:has-text("master")');

  await page.click('button:has-text("Push")');

  // Create a new branch
  await page.click('button:has-text("Branches")');

  await page.fill('[placeholder="testing-branch"]', 'new-feature');

  await page.press('[placeholder="testing-branch"]', 'Enter');

  await page.click('text=Done');

  // Create a new request
  await page.click('div:nth-child(3) .btn');

  await page.click('.dropdown__text:has-text("New Request")');

  await page.press('[placeholder="My Request"]', 'Enter');

  // Commit the new changes
  await page.click('button:has-text("new-feature")');

  await page.click('button:has-text("Commit")');

  await page.fill('textarea[name="commit-message"]', 'Add new request');

  await page.check('input[name="select-all"]');

  await page.click('button:has-text("Commit")');

  await page.click('button:has-text("new-feature")');

  await page.click('button:has-text("History (2)")');

  await page.click('text=Add new request');

  await page.click('text=Done');

  // Merge the new branch to master
  await page.click('button:has-text("new-feature")');

  await page.click('button:has-text("Branches")');

  await page.click('text=Checkout');

  await page.click('text=Merge');

  await page.click('button:has-text("Click to confirm")');

  await page.click('text=Local Branches');

  await page.click('text=Done');
});
