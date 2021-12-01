import { FC } from 'react';

import { useMenuBarVisibility } from '../hooks/settings-hooks';
import { useSyncMigration } from '../hooks/use-sync-migration';
import { useFontMutations } from '../hooks/use-font-mutations';

export const AppHooks: FC = () => {
  useSyncMigration();
  useMenuBarVisibility();
  useFontMutations();
  return null;
};
