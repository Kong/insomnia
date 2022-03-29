import { FC } from 'react';

import { useSettingsSideEffects } from '../hooks/use-settings-side-effects';
import { useSyncMigration } from '../hooks/use-sync-migration';

export const AppHooks: FC = () => {
  useSyncMigration();
  useSettingsSideEffects();
  return null;
};
