import { GitVCS } from './git-vcs';

export interface FileWithStatus {
  filePath: string;
  status: string;
}

const isAdded = ({ status }: FileWithStatus) => status.includes('added');

const isNotAdded = ({ status }: FileWithStatus) => !status.includes('added');

export const gitRollback = async (vcs: GitVCS, files: FileWithStatus[]) => {
  const addedFiles = files.filter(isAdded);
  // Remove and delete added (unversioned) files
  const promises = addedFiles.map(async ({ filePath }) => {
    await vcs.remove(filePath);
    console.log(`[git-rollback] Delete relPath=${filePath}`);
    // @ts-expect-error -- TSCONVERSION
    await vcs.getFs().promises.unlink(filePath);
  });
  // Rollback existing (versioned) files
  const existingFiles = files.filter(isNotAdded).map(f => f.filePath);

  if (existingFiles.length) {
    promises.push(vcs.undoPendingChanges(existingFiles));
  }

  await Promise.all(promises);
};
