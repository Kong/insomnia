import * as client from '../modules/client';
import * as home from '../modules/home';
import * as settings from '../modules/settings';
import * as modal from '../modules/modal';
import * as dropdown from '../modules/dropdown';

import { isPackage, launchApp, stop } from '../modules/application';
import { Application } from 'spectron';

const itIf = (condition: boolean) => (condition ? it : it.skip);
// @ts-expect-error -- TSCONVERSION need to augment jest
it.if = itIf;

xdescribe('Application launch', function() {
  jest.setTimeout(50000);
  // @ts-expect-error -- TSCONVERSION
  let app: Application = null;

  beforeEach(async () => {
    app = await launchApp();
  });

  afterEach(async () => {
    await stop(app);
  });

  // @ts-expect-error -- TSCONVERSION need to augment jest
  xit.if(isPackage())('can install and consume a plugin', async () => {
    await client.correctlyLaunched(app);
    await home.documentListingShown(app);

    // Install plugin
    await settings.openWithKeyboardShortcut(app);
    await settings.goToPlugins(app);
    await settings.installPlugin(app, 'insomnia-plugin-kong-bundle');
    await settings.closeModal(app);

    // Open card dropdown for any card
    const dd = await home.openDocumentMenuDropdown(app);

    // Click the "Deploy to Portal" button, installed from that plugin
    await dropdown.clickDropdownItemByText(dd, 'Deploy to Portal');

    // Ensure a modal opens, then close it - the rest is plugin behavior
    // @ts-expect-error -- TSCONVERSION appears to be genuine
    await modal.waitUntilOpened(app, { title: 'Deploy to Portal' });
    // @ts-expect-error -- TSCONVERSION appears to be genuine
    await modal.close(app);
  });
});
