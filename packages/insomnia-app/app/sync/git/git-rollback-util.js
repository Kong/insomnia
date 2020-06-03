// @flow
import GitVCS from './git-vcs';

export type FileWithStatus = { filePath: string, status: string };

const isAdded = ({ status }: FileWithStatus) => status.includes('added');

export const gitRollback = async (vcs: GitVCS, files: Array<FileWithStatus>): Promise<void> => {
  const addedFiles = files.filter(isAdded);
  const existingFiles = files.filter(!isAdded);

  const deletePromises = addedFiles.map(async ({ filePath }) => {
    await vcs.remove(filePath);
    console.log(`[fs] Unlink relPath=${filePath}`);
    await this.getFs().promises.unlink(filePath);
  });

  const undoPromise = vcs.undoPendingChanges(existingFiles);

  await Promise.all(undoPromise, ...deletePromises);
};
