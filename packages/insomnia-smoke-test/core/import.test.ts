import { Application } from 'spectron';

import { launchApp, stop, writeTextToClipboard } from '../modules/application';
import * as client from '../modules/client';
import * as debug from '../modules/debug';
import * as design from '../modules/design';
import { loadFixture } from '../modules/fixtures';
import * as home from '../modules/home';
import * as modal from '../modules/modal';
import * as onboarding from '../modules/onboarding';
import * as settings from '../modules/settings';

describe.only('Import', function() {
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
      // Launch the app
      await client.correctlyLaunched(app);
      await onboarding.skipOnboardingFlow(app);

      await home.documentListingShown(app);
      await home.expectTotalDocuments(app, 0);

      // Import the fixture from the clipboard
      const swagger2Text = await loadFixture('swagger2.yaml');

      writeTextToClipboard(app, swagger2Text);

      await home.importFromClipboard(app);

      // Import as a design document
      await modal.waitUntilOpened(app, { title: 'Import As' });
      await modal.clickModalFooterByText(app, 'Design Document');

      await home.expectTotalDocuments(app, 1);

      // Open the new document and send a request
      await home.openDocumentWithTitle(app, 'E2E testing specification - swagger 2 1.0.0');

      await design.goToActivity(app, 'debug');

      await debug.clickFolderByName(app, 'custom-tag');

      await debug.clickRequestByName(app, 'get pet by id');

      await debug.clickSendRequest(app);

      await debug.expect200(app);
    });

    it('should prompt the user to import to a new workspace', async () => {
      // Launch the app
      await client.correctlyLaunched(app);
      await onboarding.skipOnboardingFlow(app);

      await home.documentListingShown(app);

      // Create a document
      await home.createNewCollection(app);
      await debug.goToDashboard(app);

      await home.expectTotalDocuments(app, 1);

      // Import the fixture from the clipboard
      const swagger2Text = await loadFixture('swagger2.yaml');

      writeTextToClipboard(app, swagger2Text);

      await home.importFromClipboard(app);

      // Chose to import to a new workspace as a design document
      await modal.waitUntilOpened(app, { title: 'Import' });
      await modal.clickModalFooterByText(app, 'New');

      await modal.waitUntilOpened(app, { title: 'Import As' });
      await modal.clickModalFooterByText(app, 'Design Document');

      await home.expectTotalDocuments(app, 2);

      // Open the new document and send a request
      await home.openDocumentWithTitle(app, 'E2E testing specification - swagger 2 1.0.0');

      await design.goToActivity(app, 'debug');

      await debug.clickFolderByName(app, 'custom-tag');

      await debug.clickRequestByName(app, 'get pet by id');

      await debug.clickSendRequest(app);

      await debug.expect200(app);
    });

    it('should prompt the user to import to an existing workspace', async () => {
      // Launch the app
      await client.correctlyLaunched(app);
      await onboarding.skipOnboardingFlow(app);

      await home.documentListingShown(app);

      // Create a document
      const newCollectionName = await home.createNewCollection(app, 'New');
      await debug.goToDashboard(app);

      await home.expectTotalDocuments(app, 1);

      // Import the fixture from the clipboard
      const swagger2Text = await loadFixture('swagger2.yaml');

      writeTextToClipboard(app, swagger2Text);

      await home.importFromClipboard(app);

      // Chose to import to the existing document
      await modal.waitUntilOpened(app, { title: 'Import' });
      await modal.clickModalFooterByText(app, 'Existing');

      await modal.selectModalOption(app, newCollectionName);
      await modal.clickModalFooterByText(app, 'Done');

      await home.expectTotalDocuments(app, 1);

      // Since the workspace we import has a name it overrides the existing one
      // Open the new document and send a request
      await home.openDocumentWithTitle(app, 'E2E testing specification - swagger 2 1.0.0');

      await debug.clickFolderByName(app, 'custom-tag');

      await debug.clickRequestByName(app, 'get pet by id');

      await debug.clickSendRequest(app);

      await debug.expect200(app);
    });

    it('should update the existing workspace (e.g. Insomnia Exports)', async () => {
      // Launch the app
      await client.correctlyLaunched(app);
      await onboarding.skipOnboardingFlow(app);

      await home.documentListingShown(app);

      await home.expectTotalDocuments(app, 0);

      // Import the fixture from the clipboard
      const insomnia4Text = await loadFixture('insomnia4.yaml');

      writeTextToClipboard(app, insomnia4Text);

      await home.importFromClipboard(app);

      // Chose to import as a collection
      await modal.waitUntilOpened(app, { title: 'Import As' });
      await modal.clickModalFooterByText(app, 'Request Collection');

      await home.expectTotalDocuments(app, 1);

      // Import the spec a second time
      await home.importFromClipboard(app);

      // It should update the existing document
      await home.expectTotalDocuments(app, 1);

      // Open the new document and send a request
      await home.openDocumentWithTitle(app, 'Insomnia');

      await debug.clickFolderByName(app, 'Actions');

      await debug.clickRequestByName(app, 'Get Sleep');

      await debug.clickSendRequest(app);

      await debug.expect200(app);
    });
  });

  describe('from Preferences', () => {
    it('should directly import to the active workspace', async () => {
      // Launch the app
      await client.correctlyLaunched(app);
      await onboarding.skipOnboardingFlow(app);

      await home.documentListingShown(app);
      await home.expectTotalDocuments(app, 0);

      // Create a document and open it
      await home.createNewCollection(app);

      // Import the fixture from the preferences panel
      const swagger2Text = await loadFixture('swagger2.yaml');

      writeTextToClipboard(app, swagger2Text);

      await settings.openFromSettingsButton(app);
      await settings.goToDataTab(app);
      await settings.importFromClipboard(app);

      // Send a request
      await debug.clickFolderByName(app, 'custom-tag');
      await debug.clickRequestByName(app, 'get pet by id');

      await debug.clickSendRequest(app);

      await debug.expect200(app);

      // Navigate to the dashboard and check no other workspace was created
      await debug.goToDashboard(app);
      await home.expectTotalDocuments(app, 1);
    });

    it('should import an existing workspace to the project instead of the current workspace (e.g. Insomnia Exports)', async () => {
      // Launch the app
      await client.correctlyLaunched(app);
      await onboarding.skipOnboardingFlow(app);

      await home.documentListingShown(app);
      await home.expectTotalDocuments(app, 0);
      // Import the fixture from the clipboard
      const insomnia4Text = await loadFixture('insomnia4.yaml');

      writeTextToClipboard(app, insomnia4Text);

      await home.importFromClipboard(app);

      await modal.waitUntilOpened(app, { title: 'Import As' });
      await modal.clickModalFooterByText(app, 'Design Document');

      await home.expectTotalDocuments(app, 1);

      // Create a document and open it
      await home.createNewCollection(app);

      // Import the updated fixture from the preferences panel
      const insomnia4UpdatedText = await loadFixture('insomnia4-update.yaml');

      writeTextToClipboard(app, insomnia4UpdatedText);
      await settings.openFromSettingsButton(app);
      await settings.goToDataTab(app);
      await settings.importFromClipboard(app);

      // NOTE: The document was imported directly to the
      // previously imported workspace and the user didn't see a dialog

      // Open the previous document and check that it's updated
      await debug.goToDashboard(app);

      await home.expectTotalDocuments(app, 2);

      await home.openDocumentWithTitle(app, 'Insomnia');

      await design.goToActivity(app, 'debug');

      await debug.clickFolderByName(app, 'Actions');

      await debug.clickRequestByName(app, 'Get Sleep 2');

      await debug.clickSendRequest(app);

      await debug.expect200(app);
    });
  });
});
