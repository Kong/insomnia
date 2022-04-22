import { useAsync } from 'react-use';

import { onLoginLogout } from '../../account/session';
import { getDataDirectory } from '../../common/electron-helpers';
import FileSystemDriver from '../../sync/store/drivers/file-system-driver';
import { migrateCollectionsIntoRemoteProject } from '../../sync/vcs/migrate-collections';
import { VCS } from '../../sync/vcs/vcs';

const check = async () => {
  const driver = FileSystemDriver.create(getDataDirectory());
  await migrateCollectionsIntoRemoteProject(new VCS(driver));
};

// Check on login / logout
onLoginLogout(isLoggedIn => {
  if (isLoggedIn) {
    check();
  }
});

export const useSyncMigration = () => {
  // Check once on mount
  useAsync(check, []);
};
