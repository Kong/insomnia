import type { MergeConflict } from '~/insomnia-data';

import FileSystemDriver from '../store/drivers/file-system-driver';
import { VCS } from './vcs';

export type ConflictHandler = (
  conflicts: MergeConflict[],
  labels: { ours: string; theirs: string },
) => Promise<MergeConflict[]>;

export const createVCS = ({ dataPath, conflictHandler }: { dataPath: string; conflictHandler?: ConflictHandler }) => {
  return new VCS(FileSystemDriver.create(dataPath), conflictHandler);
};

export type { VCS };
