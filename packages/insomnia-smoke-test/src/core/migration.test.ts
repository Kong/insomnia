import * as client from '../modules/client';
import { launchApp, stop } from '../modules/application';
import * as onboarding from '../modules/onboarding';
import * as migration from '../modules/migration';
import * as home from '../modules/home';
import path from 'path';

describe('Migration', function() {
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

    await onboarding.skipOnboardingFlow(app);

    await home.documentListingShown(app);
    await home.expectTotalDocuments(app, 1);
    await home.expectDocumentWithTitle(app, 'Insomnia');

    await app.restart();
    await client.focusAfterRestart(app);

    await home.documentListingShown(app);
  });

  it('can migrate and proceed onboarding', async () => {
    await client.correctlyLaunched(app);

    await migration.migrationMessageShown(app);
    await migration.ensureStartNotClickable(app);

    await migration.toggleOption(app, 'Copy Workspaces');
    await migration.toggleOption(app, 'Copy Plugins');
    await migration.toggleOption(app, 'Copy Designer Application Settings');
    await migration.clickStart(app);

    await migration.successMessageShown(app);
    await migration.clickRestart(app);

    await client.focusAfterRestart(app);

    await onboarding.skipOnboardingFlow(app);

    await home.documentListingShown(app);
    await home.expectTotalDocuments(app, 2);
    await home.expectDocumentWithTitle(app, 'Insomnia');
    await home.expectDocumentWithTitle(app, 'BASIC-DESIGNER-FIXTURE'); // imported from fixture

    await app.restart();
    await client.focusAfterRestart(app);

    await home.documentListingShown(app);
  });
});
