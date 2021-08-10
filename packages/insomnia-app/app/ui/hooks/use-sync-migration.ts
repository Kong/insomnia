import { useEffect } from 'react';
import { useInterval } from 'react-use';

import { getDataDirectory } from '../../common/electron-helpers';
import FileSystemDriver from '../../sync/store/drivers/file-system-driver';
import { migrateCollectionsIntoRemoteSpace } from '../../sync/vcs/migrate-collections';
import { VCS } from '../../sync/vcs/vcs';
import { invokeAsyncSynchronously } from './effect-helpers';

const check = async () => {
  const driver = FileSystemDriver.create(getDataDirectory());
  await migrateCollectionsIntoRemoteSpace(new VCS(driver));
};

const INTERVAL = 1000 * 60 * 30; // 30 minutes

export const useSyncMigration = () => {
  // Check once on mount
  useEffect(() => invokeAsyncSynchronously(check), []);

  // Setup check on interval
  useInterval(check, INTERVAL);
};
