import * as client from '../modules/client';
import { launchApp, stop } from '../modules/application';
import * as onboarding from '../modules/onboarding';
import * as migration from '../modules/migration';
import * as home from '../modules/home';
import path from 'path';

describe('Application launch', function() {
  jest.setTimeout(50000);
  let app = null;

  beforeEach(async () => {
    app = await launchApp(path.join(__dirname, '..', 'fixtures', 'basic-designer'));
  });

  afterEach(async () => {
    await stop(app);
  });

  it('can skip migration and proceed onboarding', async () => {
    await client.correctlyLaunched(app);

    await migration.migrationMessageShown(app);

    await migration.clickSkip(app);

    await onboarding.analyticsMessageShown(app);
    await onboarding.clickDontShare(app);
    await onboarding.clickSkipImport(app);

    await home.documentListingShown(app);
    await home.expectTotalDocuments(app, 1);
    await home.expectDocumentWithTitle(app, 'Insomnia');
  });

  it('can migrate and proceed onboarding', async () => {
    await client.correctlyLaunched(app);

    await migration.migrationMessageShown(app);
    await migration.clickStart(app);
    await migration.successMessageShown(app);
    await migration.clickRestart(app);

    // Wait for app to restart
    await app.client.pause(2000);

    const count = await app.client.getWindowCount();
    if (count === 0) {
      console.log('No windows found');
    }

    await app.client.windowByIndex(0);

    await onboarding.analyticsMessageShown(app);
    await onboarding.clickDontShare(app);
    await onboarding.clickSkipImport(app);

    await home.documentListingShown(app);
    await home.expectTotalDocuments(app, 2);
    await home.expectDocumentWithTitle(app, 'Insomnia');
    await home.expectDocumentWithTitle(app, 'BASIC-DESIGNER-FIXTURE'); // imported from fixture
  });
});
