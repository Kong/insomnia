import { showModal } from '../../ui/components/modals';
import { SyncMergeModal } from '../../ui/components/modals/sync-merge-modal';
import FileSystemDriver from '../store/drivers/file-system-driver';
import { MergeConflict } from '../types';
import { VCS } from './vcs';

let vcs: VCS | null = null;

export const VCSInstance = () => {
  if (vcs) {
    return vcs;
  }
  const driver = FileSystemDriver.create(
    process.env['INSOMNIA_DATA_PATH'] || window.app.getPath('userData'),
  );
  vcs = new VCS(driver, async (conflicts, labels) => {
    return new Promise(resolve => {
      showModal(SyncMergeModal, {
        conflicts,
        labels,
        handleDone: (conflicts?: MergeConflict[]) =>
          resolve(conflicts || []),
      });
    });
  });

  return vcs;
};
