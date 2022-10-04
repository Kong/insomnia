import { ipcRenderer } from 'electron/renderer';
import { FC, useEffect } from 'react';

import { useAppCommands } from '../hooks/use-app-commands';
import { useDragAndDropImportFile } from '../hooks/use-drag-and-drop-import-file';
import { useGlobalKeyboardShortcuts } from '../hooks/use-global-keyboard-shortcuts';
import { useSettingsSideEffects } from '../hooks/use-settings-side-effects';
import { useSyncMigration } from '../hooks/use-sync-migration';
import { useThemeChange } from '../hooks/use-theme-change';

export const AppHooks: FC = () => {
  useSyncMigration();
  useSettingsSideEffects();
  useGlobalKeyboardShortcuts();
  useDragAndDropImportFile();
  useThemeChange();
  useAppCommands();
  // Give it a bit before letting the backend know it's ready
  useEffect(() => {
    setTimeout(() => ipcRenderer.send('window-ready'), 500);
  }, []);

  return null;
};
