// @flow

import { createSelector } from 'reselect';
import { selectActiveWorkspace, selectEntitiesLists } from './selectors';
import type { ProtoDirectory } from '../../models/proto-directory';
import type { ProtoFile } from '../../models/proto-file';

export type ExpandedProtoDirectory = {
  files: Array<ProtoFile>,
  dir: ProtoDirectory | null,
  subDirs: Array<ExpandedProtoDirectory>,
};

const selectAllProtoFiles = createSelector(
  selectEntitiesLists,
  entities => entities.protoFiles || [],
);

const selectAllProtoDirectories = createSelector(
  selectEntitiesLists,
  entities => entities.protoDirectories || [],
);

export const selectExpandedActiveProtoDirectories = createSelector(
  selectActiveWorkspace,
  selectAllProtoFiles,
  selectAllProtoDirectories,
  (workspace, allFiles, allDirs): Array<ExpandedProtoDirectory> => {
    // Get files where the parent is the workspace
    const individualFiles = allFiles.filter(pf => pf.parentId === workspace._id);

    // Get directories where the parent is the workspace
    const rootDirs = allDirs.filter(pd => pd.parentId === workspace._id);

    // Expand each directory
    const expandedDirs = rootDirs.map(dir => expandDir(dir, allFiles, allDirs));

    if (individualFiles.length) {
      return [{ files: individualFiles, dir: null, subDirs: [] }, ...expandedDirs];
    }

    return expandedDirs;
  },
);

const expandDir = (
  dir: ProtoDirectory,
  allFiles: Array<ProtoFile>,
  allDirs: Array<ProtoDirectory>,
): ExpandedProtoDirectory => {
  const filesInDir = allFiles.filter(pf => pf.parentId === dir._id);
  const subDirs = allDirs.filter(pd => pd.parentId === dir._id);

  // Expand sub directories
  const expandedSubDirs = subDirs.map(subDir => expandDir(subDir, allFiles, allDirs));

  return { dir, files: filesInDir, subDirs: expandedSubDirs };
};
