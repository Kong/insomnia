import type { MergeConflict } from '../../sync/types';
import FileSystemDriver from './core/store/drivers/file-system-driver';
import { VCS } from './core/vcs';

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
