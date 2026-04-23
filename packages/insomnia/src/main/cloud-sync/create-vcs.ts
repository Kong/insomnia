import type { MergeConflict } from '../../sync/types';
import FileSystemDriver from '../../sync/vcs/store/drivers/file-system-driver';
import { VCS } from '../../sync/vcs/vcs';

export type ConflictHandler = (
  conflicts: MergeConflict[],
  labels: { ours: string; theirs: string },
) => Promise<MergeConflict[]>;

export const createVCS = ({
  dataPath,
  conflictHandler,
}: {
  dataPath: string;
  conflictHandler?: ConflictHandler;
}) => {
  return new VCS(FileSystemDriver.create(dataPath), conflictHandler);
};
