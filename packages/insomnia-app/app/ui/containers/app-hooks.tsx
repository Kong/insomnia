import { FC } from 'react';

import { useMenuBarVisibility } from '../hooks/settings-hooks';
import { useSyncMigration } from '../hooks/use-sync-migration';

export const AppHooks: FC = () => {
  useSyncMigration();
  useMenuBarVisibility();

  return null;
};
