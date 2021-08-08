import { getDataDirectory } from '../common/electron-helpers';
import FileSystemDriver from '../sync/store/drivers/file-system-driver';
import { migrateCollectionsIntoRemoteSpace } from '../sync/vcs/migrate-collections';
import { VCS } from '../sync/vcs/vcs';

const INTERVAL = 1000 * 60 * 30; // 30 minutes

const check = async () => {
  const directory = path.join(getDataDirectory(), 'version-control');
  const driver = new FileSystemDriver({ directory });
  await migrateCollectionsIntoRemoteSpace(new VCS(driver));
};

export async function init() {
  setInterval(check, INTERVAL);
  await check();
}
