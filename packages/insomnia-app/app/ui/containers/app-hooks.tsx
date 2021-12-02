import { FC } from 'react';

import { useMenuBarVisibility } from '../hooks/settings-hooks';
import { useSettingsSideEffects } from '../hooks/use-settings-side-effects';
import { useSyncMigration } from '../hooks/use-sync-migration';

export const AppHooks: FC = () => {
  useSyncMigration();
  useMenuBarVisibility();
  useSettingsSideEffects();
  return null;
};
