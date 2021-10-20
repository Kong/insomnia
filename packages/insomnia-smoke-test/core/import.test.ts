import { Application } from 'spectron';

import { launchApp, stop, writeTextToClipboard } from '../modules/application';
import * as client from '../modules/client';
import * as debug from '../modules/debug';
import { getFixtureContent } from '../modules/fixtures';
import * as home from '../modules/home';
import * as modal from '../modules/modal';
import * as onboarding from '../modules/onboarding';
import * as settings from '../modules/settings';

describe('Import', function() {
  jest.setTimeout(50000);

  let app: Application;

  beforeEach(async () => {
    app = await launchApp();
  });

  afterEach(async () => {
    await stop(app);
  });

  describe('from the Dashboard', () => {
    it('should create a new workspace if there are no available workspaces', async () => {
      await client.correctlyLaunched(app);
      await onboarding.skipOnboardingFlow(app);

      await home.documentListingShown(app);
      await home.expectTotalDocuments(app, 0);
      const swagger2Text = await getFixtureContent('swagger2.yaml');

      writeTextToClipboard(app, swagger2Text);

      await home.importFromClipboard(app);

      await modal.waitUntilOpened(app, { title: 'Import As' });
      await modal.clickModalFooterByText(app, 'Design Document');

      await home.expectTotalDocuments(app, 1);
    });

    it('should prompt the user to import to a new workspace', async () => {
      await client.correctlyLaunched(app);
      await onboarding.skipOnboardingFlow(app);

      await home.documentListingShown(app);
      await home.createNewCollection(app);
      await debug.goToDashboard(app);

      await home.expectTotalDocuments(app, 1);

      const swagger2Text = await getFixtureContent('swagger2.yaml');

      writeTextToClipboard(app, swagger2Text);

      await home.importFromClipboard(app);

      await modal.waitUntilOpened(app, { title: 'Import' });
      await modal.clickModalFooterByText(app, 'New');

      await modal.waitUntilOpened(app, { title: 'Import As' });
      await modal.clickModalFooterByText(app, 'Design Document');

      await home.expectTotalDocuments(app, 2);
    });

    it('should prompt the user to import to an existing workspace', async () => {
      await client.correctlyLaunched(app);
      await onboarding.skipOnboardingFlow(app);

      await home.documentListingShown(app);
      const newCollectionName = await home.createNewCollection(app, 'New');
      await debug.goToDashboard(app);

      await home.expectTotalDocuments(app, 1);

      const swagger2Text = await getFixtureContent('swagger2.yaml');

      writeTextToClipboard(app, swagger2Text);

      await home.importFromClipboard(app);

      await modal.waitUntilOpened(app, { title: 'Import' });
      await modal.clickModalFooterByText(app, 'Existing');

      await modal.selectModalOption(app, newCollectionName);
      await modal.clickModalFooterByText(app, 'Done');

      await home.expectTotalDocuments(app, 1);
    });

    it('should update the existing workspace (e.g. Insomnia Exports)', async () => {
      await client.correctlyLaunched(app);
      await onboarding.skipOnboardingFlow(app);

      await home.documentListingShown(app);

      await home.expectTotalDocuments(app, 0);

      // Import the insomnia spec
      const insomnia4Text = await getFixtureContent('insomnia4.yaml');

      writeTextToClipboard(app, insomnia4Text);

      await home.importFromClipboard(app);

      await modal.waitUntilOpened(app, { title: 'Import As' });
      await modal.clickModalFooterByText(app, 'Request Collection');

      await home.expectTotalDocuments(app, 1);

      // Import the swagger spec a second time
      await home.importFromClipboard(app);

      await home.expectTotalDocuments(app, 1);
    });
  });

  describe('from Preferences', () => {
    it('should directly import to the active workspace', async () => {
      await client.correctlyLaunched(app);
      await onboarding.skipOnboardingFlow(app);

      await home.documentListingShown(app);
      await home.expectTotalDocuments(app, 0);
      await home.createNewCollection(app);

      const swagger2Text = await getFixtureContent('swagger2.yaml');

      writeTextToClipboard(app, swagger2Text);

      await settings.openFromSettingsButton(app);
      await settings.goToDataTab(app);
      await settings.importFromClipboard(app);

      await debug.clickFolderByName(app, 'custom-tag');
      await debug.clickRequestByName(app, 'get pet by id');

      // Click send
      await debug.clickSendRequest(app);

      // Ensure 200
      await debug.expect200(app);

      await debug.goToDashboard(app);
      await home.expectTotalDocuments(app, 1);
    });

    it('should update the existing workspace (e.g. Insomnia Exports)', async () => {
      await client.correctlyLaunched(app);
      await onboarding.skipOnboardingFlow(app);

      await home.documentListingShown(app);
      await home.expectTotalDocuments(app, 0);

      // Import the insomnia spec
      const insomnia4Text = await getFixtureContent('insomnia4.yaml');

      writeTextToClipboard(app, insomnia4Text);

      await home.importFromClipboard(app);

      await modal.waitUntilOpened(app, { title: 'Import As' });
      await modal.clickModalFooterByText(app, 'Design Document');

      await home.createNewCollection(app);

      await settings.openFromSettingsButton(app);
      await settings.goToDataTab(app);
      await settings.importFromClipboard(app);

      await debug.goToDashboard(app);

      await home.expectTotalDocuments(app, 2);
    });
  });
});
