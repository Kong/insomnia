import { ipcRenderer } from 'electron';
import { FC, useEffect } from 'react';

import { useGlobalKeyboardShortcuts } from '../hooks/use-global-keyboard-shortcuts';
import { useSettingsSideEffects } from '../hooks/use-settings-side-effects';
import { useSyncMigration } from '../hooks/use-sync-migration';
import { useThemeChange } from '../hooks/use-theme-change';

export const AppHooks: FC = () => {
  useSyncMigration();
  useSettingsSideEffects();
  useGlobalKeyboardShortcuts();
  useThemeChange();
  // Give it a bit before letting the backend know it's ready
  useEffect(() => {
    setTimeout(() => ipcRenderer.send('window-ready'), 500);
  }, []);

  return null;
};
