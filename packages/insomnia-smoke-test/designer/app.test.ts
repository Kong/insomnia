import { Application } from 'spectron';

import { isPackage, launchApp, stop } from '../modules/application';
import * as client from '../modules/client';
import * as dropdown from '../modules/dropdown';
import * as home from '../modules/home';
import * as modal from '../modules/modal';
import * as settings from '../modules/settings';

const itIf = condition => (condition ? it : it.skip);
// @ts-expect-error TSCONVERSION
it.if = itIf;

xdescribe('Application launch', function() {
  jest.setTimeout(50000);
  let app: Application;

  beforeEach(async () => {
    app = await launchApp();
  });

  afterEach(async () => {
    await stop(app);
  });

  // @ts-expect-error TSCONVERSION
  xit.if(isPackage())('can install and consume a plugin', async () => {
    await client.correctlyLaunched(app);
    await home.documentListingShown(app);

    // Install plugin
    await settings.openWithKeyboardShortcut(app);
    await settings.goToPlugins(app);
    await settings.installPlugin(app, 'insomnia-plugin-kong-portal');
    await settings.closeModal(app);

    // Open card dropdown for any card
    const dd = await home.openWorkspaceCardDropdown(app);

    // Click the "Deploy to Dev Portal" button, installed from that plugin
    await dropdown.clickDropdownItemByText(dd, 'Deploy to Dev Portal');

    // Ensure a modal opens, then close it - the rest is plugin behavior
    await modal.waitUntilOpened(app, { title: 'Deploy to Dev Portal' });
    await modal.close(app);
  });
});
