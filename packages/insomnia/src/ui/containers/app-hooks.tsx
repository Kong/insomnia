import { FC } from 'react';

import { useGlobalKeyboardShortcuts } from '../hooks/use-global-keyboard-shortcuts';
import { useSettingsSideEffects } from '../hooks/use-settings-side-effects';
import { useSyncMigration } from '../hooks/use-sync-migration';

export const AppHooks: FC = () => {
  useSyncMigration();
  useSettingsSideEffects();
  useGlobalKeyboardShortcuts();
  return null;
};
