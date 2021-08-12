import { FC } from 'react';

import { useSyncMigration } from '../hooks/use-sync-migration';

export const AppHooks: FC = () => {
  useSyncMigration();

  return null;
};
