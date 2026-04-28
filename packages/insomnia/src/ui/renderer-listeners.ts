import { services } from '~/insomnia-data';
import { type RAToastContent, showToast } from '~/ui/components/toast-notification';

import * as plugins from '../plugins';
import * as themes from '../plugins/misc';
import * as templating from '../templating';
import { showModal } from './components/modals';
import { SettingsModal } from './components/modals/settings-modal';

window.main.on('toggle-preferences', () => {
  showModal(SettingsModal);
});

window.main.on('reload-plugins', async () => {
  const settings = await services.settings.get();
  await plugins.reloadPlugins();
  await themes.applyColorScheme(settings);
  templating.reload();
  console.log('[plugins] reloaded');
});

window.main.on('toggle-preferences-shortcuts', () => {
  showModal(SettingsModal, { tab: 'keyboard' });
});

window.main.on('show-toast', (_, options: { content: RAToastContent; options?: { timeout?: number } }) => {
  showToast(options.content, options.options);
});
