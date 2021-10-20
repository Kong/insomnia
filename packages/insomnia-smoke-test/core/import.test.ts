import fs from 'fs';
import { Application } from 'spectron';

import { launchApp, stop } from '../modules/application';
import * as client from '../modules/client';
import * as debug from '../modules/debug';
import * as home from '../modules/home';
import * as modal from '../modules/modal';
import * as onboarding from '../modules/onboarding';
import * as settings from '../modules/settings';

describe('Import', function() {
  jest.setTimeout(50000);

  describe('from the Dashboard', () => {
    let app: Application;

    beforeEach(async () => {
      app = await launchApp();
    });

    afterEach(async () => {
      await stop(app);
    });

    it('should create a new workspace if there are no available workspaces', async () => {
      await client.correctlyLaunched(app);
      await onboarding.skipOnboardingFlow(app);

      await home.documentListingShown(app);
      await home.expectTotalDocuments(app, 0);

      const buffer = await fs.promises.readFile(
        `${__dirname}/../fixtures/swagger2.yaml`
      );
      const swagger2Text = buffer.toString();
      await app.electron.clipboard.writeText(swagger2Text);

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

      const buffer = await fs.promises.readFile(
        `${__dirname}/../fixtures/swagger2.yaml`
      );
      const swagger2Text = buffer.toString();

      await app.electron.clipboard.writeText(swagger2Text);

      await home.importFromClipboard(app);

      await modal.waitUntilOpened(app, { title: 'Import' });
      await modal.clickModalFooterByText(app, 'New Workspace');

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

      const buffer = await fs.promises.readFile(
        `${__dirname}/../fixtures/swagger2.yaml`
      );

      const swagger2Text = buffer.toString();
      await app.electron.clipboard.writeText(swagger2Text);

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
      const buffer = await fs.promises.readFile(
        `${__dirname}/../fixtures/insomnia4.yaml`
      );
      const insomnia4Text = buffer.toString();
      await app.electron.clipboard.writeText(insomnia4Text);

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
    let app: Application;

    beforeEach(async () => {
      app = await launchApp();
    });

    afterEach(async () => {
      await stop(app);
    });

    it('should directly import to the active workspace', async () => {
      await client.correctlyLaunched(app);
      await onboarding.skipOnboardingFlow(app);

      await home.documentListingShown(app);
      await home.expectTotalDocuments(app, 0);
      await home.createNewCollection(app);

      const buffer = await fs.promises.readFile(
        `${__dirname}/../fixtures/swagger2.yaml`
      );

      const swagger2Text = buffer.toString();
      await app.electron.clipboard.writeText(swagger2Text);

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
      const buffer = await fs.promises.readFile(
        `${__dirname}/../fixtures/insomnia4.yaml`
      );
      const insomnia4Text = buffer.toString();
      await app.electron.clipboard.writeText(insomnia4Text);
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
