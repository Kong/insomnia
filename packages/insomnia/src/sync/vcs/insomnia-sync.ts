import { showModal } from '../../ui/components/modals';
import { SyncMergeModal } from '../../ui/components/modals/sync-merge-modal';
import FileSystemDriver from '../store/drivers/file-system-driver';
import { MergeConflict } from '../types';
import { VCS } from './vcs';

const driver = FileSystemDriver.create(
  process.env['INSOMNIA_DATA_PATH'] || window.app.getPath('userData'),
);

console.log('Initializing VCS');
const vcs = await new VCS(driver, async conflicts => {
  return new Promise(resolve => {
    showModal(SyncMergeModal, {
      conflicts,
      handleDone: (conflicts?: MergeConflict[]) =>
        resolve(conflicts || []),
    });
  });
});

export default vcs;
