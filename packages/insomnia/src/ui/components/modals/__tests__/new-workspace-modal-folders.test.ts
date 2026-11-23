import { describe, expect, it } from 'vitest';

import type { PendingFolder, RepoTreeNode } from '../new-workspace-modal-folders';
import { getSiblingNames, mergePendingFolders, removePendingFolder } from '../new-workspace-modal-folders';

const tree: RepoTreeNode = {
  id: '',
  name: 'REPO',
  type: 'root',
  children: [
    { id: 'apis', name: 'apis', type: 'directory', children: [{ id: 'apis/a.yaml', name: 'a.yaml', type: 'file' }] },
    { id: 'README.md', name: 'README.md', type: 'file' },
  ],
};

const pending: PendingFolder[] = [
  { id: 'specs', parentId: '', name: 'specs' },
  { id: 'specs/v1', parentId: 'specs', name: 'v1' },
  { id: 'apis/payments', parentId: 'apis', name: 'payments' },
];

describe('mergePendingFolders', () => {
  it('returns the tree unchanged when there are no pending folders', () => {
    expect(mergePendingFolders(tree, [])).toEqual(tree);
  });

  it('inserts pending folders under existing and pending parents', () => {
    const merged = mergePendingFolders(tree, pending);

    expect(merged.children?.map(child => child.id)).toEqual(['specs', 'apis', 'README.md']);

    const specs = merged.children?.[0];
    expect(specs).toMatchObject({ isPending: true, type: 'directory' });
    expect(specs?.children).toEqual([{ id: 'specs/v1', name: 'v1', type: 'directory', children: [], isPending: true }]);

    const apis = merged.children?.[1];
    expect(apis?.children?.map(child => child.id)).toEqual(['apis/payments', 'apis/a.yaml']);
  });

  it('does not mutate the original tree', () => {
    mergePendingFolders(tree, pending);
    expect(tree.children).toHaveLength(2);
  });
});

describe('getSiblingNames', () => {
  it('combines existing and pending children', () => {
    const folderList = { '': ['apis', 'README.md'], 'apis': ['a.yaml'] };
    expect(getSiblingNames('', folderList, pending)).toEqual(['apis', 'README.md', 'specs']);
    expect(getSiblingNames('apis', folderList, pending)).toEqual(['a.yaml', 'payments']);
    expect(getSiblingNames('specs', folderList, pending)).toEqual(['v1']);
  });
});

describe('removePendingFolder', () => {
  it('removes the folder and its pending descendants', () => {
    expect(removePendingFolder('specs', pending)).toEqual([
      { id: 'apis/payments', parentId: 'apis', name: 'payments' },
    ]);
  });

  it('removes only the leaf when removing a leaf', () => {
    expect(removePendingFolder('specs/v1', pending).map(folder => folder.id)).toEqual(['specs', 'apis/payments']);
  });
});
