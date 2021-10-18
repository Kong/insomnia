import { Application } from 'spectron';
import { mapAccelerator } from 'spectron-keys';

import * as dropdown from './dropdown';
import * as modal from './modal';
import { clickTabByText } from './tabs';

export const openFromSettingsButton = async (app: Application) => {
  await (await app.client.$('[data-testid="settings-button"]')).click();

  await modal.waitUntilOpened(app, { modalName: 'SettingsModal' });
};

export const openWithKeyboardShortcut = async (app: Application) => {
  await app.client.keys(mapAccelerator('CommandOrControl+,'));

  await modal.waitUntilOpened(app, { modalName: 'SettingsModal' });
};

export const closeModal = async (app: Application) => {
  await modal.close(app, 'SettingsModal');
};

export const goToPluginsTab = async (app: Application) => {
  // Click on the plugins tab
  await app.client.react$('SettingsModal').then(e => clickTabByText(e, 'Plugins'));

  // Wait for the plugins component to show
  await app.client.react$('Plugins').then(e => e.waitForDisplayed());
};

export const goToDataTab = async (app: Application) => {
  await app.client.react$('SettingsModal').then(e => clickTabByText(e, 'Data'));

  await app.client.$('[data-testid="import-export-tab"]').then(e => e.waitForDisplayed());
};

export const importFromClipboard = async (app: Application) => {
  const importExport = await app.client.$('[data-testid="import-export-tab"]');
  await importExport.waitForDisplayed();

  await importExport.$('button*=Import Data').then(e => e.click());

  await dropdown.clickOpenDropdownItemByText(app, 'From Clipboard');
};

export const installPlugin = async (app, pluginName) => {
  const plugins = await app.client.react$('SettingsModal').then(e => e.react$('Plugins'));

  // Find text input and install button
  const inputField = await plugins.$('form input[placeholder="npm-package-name"]');

  // Click and wait for focus
  await inputField.waitForEnabled();
  await inputField.click();
  await inputField.waitUntil(() => inputField.isFocused());

  // Type plugin name
  await app.client.keys(pluginName);

  // Click install
  const installButton = await plugins.$('button=Install Plugin');
  await installButton.click();

  // Button and field should disable
  await plugins.waitUntil(async () => {
    const buttonEnabled = await inputField.isEnabled();
    const fieldEnabled = await installButton.isEnabled();

    return !buttonEnabled && !fieldEnabled;
  });

  // Spinner should show
  await installButton.$('i.fa.fa-refresh.fa-spin').then(e => e.waitForDisplayed());

  // Button and field should re-enable
  await plugins.waitUntil(
    async () => {
      const buttonEnabled = await inputField.isEnabled();
      const fieldEnabled = await installButton.isEnabled();

      return buttonEnabled && fieldEnabled;
    },
    { timeout: 10000, timeoutMsg: 'npm was slow to install the plugin' },
  );

  // Plugin entry should exist in the table in the first row and second column
  await app.client.waitUntilTextExists('table tr:nth-of-type(1) td:nth-of-type(2)', pluginName);
};
