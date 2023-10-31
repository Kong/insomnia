
import { isDevelopment } from '../common/constants';
import { database } from '../common/database';
import * as models from '../models';
import * as plugins from '../plugins';
import * as themes from '../plugins/misc';
import * as templating from '../templating';
import { showModal } from './components/modals';
import { AskModal } from './components/modals/ask-modal';
import { SelectModal } from './components/modals/select-modal';
import { SettingsModal, TAB_INDEX_SHORTCUTS } from './components/modals/settings-modal';

window.main.on('toggle-preferences', () => {
  showModal(SettingsModal);
});

if (isDevelopment()) {
  window.main.on('clear-model', () => {
    const options = models
      .types()
      .filter(t => t !== models.settings.type) // don't clear settings
      .map(t => ({ name: t, value: t }));

    showModal(SelectModal, {
      title: 'Clear a model',
      message: 'Select a model to clear; this operation cannot be undone.',
      value: options[0].value,
      options,
      onDone: async (type: string | null) => {
        if (type) {
          const bufferId = await database.bufferChanges();
          console.log(`[developer] clearing all "${type}" entities`);
          const allEntities = await database.all(type);
          await database.batchModifyDocs({ remove: allEntities });
          database.flushChanges(bufferId);
        }
      },
    });
  });

  window.main.on('clear-all-models', () => {
    showModal(AskModal, {
      title: 'Clear all models',
      message: 'Are you sure you want to clear all models? This operation cannot be undone.',
      yesText: 'Yes',
      noText: 'No',
      onDone: async (yes: boolean) => {
        if (yes) {
          const bufferId = await database.bufferChanges();
          const promises = models
            .types()
            .filter(t => t !== models.settings.type) // don't clear settings
            .reverse().map(async type => {
              console.log(`[developer] clearing all "${type}" entities`);
              const allEntities = await database.all(type);
              await database.batchModifyDocs({ remove: allEntities });
            });
          await Promise.all(promises);
          database.flushChanges(bufferId);
        }
      },
    });
  });
}

window.main.on('reload-plugins', async () => {
  const settings = await models.settings.get();
  await plugins.reloadPlugins();
  await themes.applyColorScheme(settings);
  templating.reload();
  console.log('[plugins] reloaded');
});

window.main.on('toggle-preferences-shortcuts', () => {
  showModal(SettingsModal, { tab: TAB_INDEX_SHORTCUTS });
});
