/**
 * A folder the user created in the new workspace modal. It only exists in the UI until a workspace file is
 * written into it, at which point the repo file watcher creates it on disk (`mkdir -p`).
 */
export interface PendingFolder {
  id: string;
  parentId: string;
  name: string;
}

export interface RepoTreeNode {
  id: string;
  name: string;
  type: 'root' | 'directory' | 'file';
  children?: RepoTreeNode[];
  isPending?: boolean;
}

/** Returns a copy of the repository tree with the pending folders inserted under their parents. */
export function mergePendingFolders(tree: RepoTreeNode, pendingFolders: PendingFolder[]): RepoTreeNode {
  if (tree.type === 'file') {
    return tree;
  }

  const pendingChildren: RepoTreeNode[] = pendingFolders
    .filter(folder => folder.parentId === tree.id)
    .map(folder => ({ id: folder.id, name: folder.name, type: 'directory', children: [], isPending: true }));

  return {
    ...tree,
    children: [...pendingChildren, ...(tree.children || [])].map(child => mergePendingFolders(child, pendingFolders)),
  };
}

/** Names of all files and folders (existing and pending) directly inside the given folder. */
export function getSiblingNames(
  parentId: string,
  folderList: Record<string, string[]>,
  pendingFolders: PendingFolder[],
): string[] {
  return [
    ...(folderList[parentId] || []),
    ...pendingFolders.filter(folder => folder.parentId === parentId).map(folder => folder.name),
  ];
}

/** Removes a pending folder together with all of its pending descendants. */
export function removePendingFolder(folderId: string, pendingFolders: PendingFolder[]): PendingFolder[] {
  const removedIds = new Set([folderId]);
  let didRemove = true;

  while (didRemove) {
    didRemove = false;
    for (const folder of pendingFolders) {
      if (!removedIds.has(folder.id) && removedIds.has(folder.parentId)) {
        removedIds.add(folder.id);
        didRemove = true;
      }
    }
  }

  return pendingFolders.filter(folder => !removedIds.has(folder.id));
}
