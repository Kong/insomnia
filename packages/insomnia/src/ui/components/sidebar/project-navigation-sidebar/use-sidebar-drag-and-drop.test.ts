import { describe, expect, it } from 'vitest';

import type { CollectionChildFlatItem, EmptyNodeFlatItem, FlatItem, ProjectWithGitRepository } from './types';
import type { BoundaryTargets, DropContext } from './use-sidebar-drag-and-drop';
import {
  canDrop,
  getIndentLevel,
  levelFromX,
  resolveDrop,
  SidebarDropTargetDelegate,
} from './use-sidebar-drag-and-drop';

// Fixtures mirror the sidebar's flat list: `level` is 0 for a direct child of a
// workspace, and `ancestors` is the root-first folder chain, so
// `ancestors.length === level`. Code under test indexes `ancestors` by level.

const project = { _id: 'proj_1', remoteId: null, name: 'Local' } as unknown as ProjectWithGitRepository;
const workspaceDoc = { _id: 'wrk_1', scope: 'collection', name: 'Collection' };

const workspaceItem = {
  kind: 'workspace',
  doc: workspaceDoc,
  project,
  collapsed: false,
  hidden: false,
  organizationId: 'org_1',
} as unknown as FlatItem;

interface ChildOptions {
  id: string;
  level: number;
  parentId: string;
  ancestors: string[];
  folder?: boolean;
  metaSortKey?: number;
  name?: string;
}

function child({ id, level, parentId, ancestors, folder = false, metaSortKey = 0, name }: ChildOptions) {
  return {
    kind: 'collectionChild',
    doc: {
      _id: id,
      type: folder ? 'RequestGroup' : 'Request',
      name: name ?? id,
      parentId,
      metaSortKey,
    },
    project,
    workspace: workspaceDoc,
    ancestors,
    level,
    pinned: false,
    collapsed: false,
    hidden: false,
    organizationId: 'org_1',
  } as unknown as CollectionChildFlatItem;
}

function emptyFolderNode(id: string, level: number, requestGroupId: string) {
  return {
    kind: 'emptyFolder',
    doc: { _id: id, name: 'Folder is empty' },
    project,
    workspace: workspaceDoc,
    requestGroup: { _id: requestGroupId },
    level,
    hidden: false,
    organizationId: 'org_1',
  } as unknown as EmptyNodeFlatItem;
}

// Rebuilds the lookups the hook derives from its flat list.
function buildIndex(items: FlatItem[]) {
  const visibles = items.filter(item => !item.hidden);
  const flatItemsById = new Map(
    visibles.map((item, index) => [item.doc._id, [item, visibles[index - 1], visibles[index + 1]] as const]),
  );
  const lookup = (id: string) => flatItemsById.get(id)?.[0] ?? null;
  // Mirrors the hook: a childless expanded folder still shows an interior.
  const hasVisibleChildren = (folderId: string) =>
    visibles.some(candidate => {
      if (candidate.hidden) {
        return false;
      }
      if (candidate.kind === 'emptyFolder') {
        return candidate.requestGroup?._id === folderId;
      }
      return candidate.kind === 'collectionChild' && candidate.doc.parentId === folderId;
    });
  return { flatItemsById, lookup, hasVisibleChildren };
}

type DropPosition = 'before' | 'after' | 'on';

function boundaryAt(items: FlatItem[], dropPosition: DropPosition, key: string) {
  const { flatItemsById, lookup, hasVisibleChildren } = buildIndex(items);
  const entry = flatItemsById.get(key);
  if (!entry) {
    throw new Error(`fixture has no visible item with id ${key}`);
  }
  const [targetItem, prevItem, nextItem] = entry;
  const boundary: BoundaryTargets = {
    dropPosition,
    targetItem,
    realTargetItem: dropPosition === 'before' ? prevItem : targetItem,
    nextItem,
  };
  return { boundary, flatItemsById, lookup, hasVisibleChildren };
}

function resolveAt(items: FlatItem[], dropPosition: DropPosition, key: string, preferredLevel: number) {
  const { boundary, flatItemsById, lookup, hasVisibleChildren } = boundaryAt(items, dropPosition, key);
  const ctx: DropContext = { hasVisibleChildren, lookup, flatItemsById, preferredLevel };
  return { boundary, ...resolveDrop(boundary, ctx) };
}

// Produces every ambiguous gap in one tree.
//
//   folder A            level 0
//     request A1        level 1
//     subfolder B       level 1
//       request B1      level 2
//   request C           level 0
const A = child({ id: 'A', level: 0, parentId: 'wrk_1', ancestors: [], folder: true, name: 'Alpha' });
const A1 = child({ id: 'A1', level: 1, parentId: 'A', ancestors: ['A'], metaSortKey: 100 });
const B = child({ id: 'B', level: 1, parentId: 'A', ancestors: ['A'], folder: true, metaSortKey: 200, name: 'Bravo' });
const B1 = child({ id: 'B1', level: 2, parentId: 'B', ancestors: ['A', 'B'], metaSortKey: 300 });
const C = child({ id: 'C', level: 0, parentId: 'wrk_1', ancestors: [], metaSortKey: 400 });
const nestedTree: FlatItem[] = [workspaceItem, A, A1, B, B1, C];

//   folder A            level 0
//     subfolder E       level 1   (empty, expanded)
//       "Folder empty"  level 1   (placeholder, not a real item)
//   request C           level 0
const E = child({ id: 'E', level: 1, parentId: 'A', ancestors: ['A'], folder: true, metaSortKey: 200, name: 'Echo' });
const emptyPlaceholder = emptyFolderNode('empty_E', 1, 'E');
const emptyTree: FlatItem[] = [workspaceItem, A, E, emptyPlaceholder, C];

describe('levelFromX', () => {
  // 1rem is 13px by default here, not the css default of 16.
  it.each([
    { level: 0, x: 39 },
    { level: 1, x: 52 },
    { level: 2, x: 65 },
    { level: 3, x: 78 },
  ])('maps a row indent guide to its own level at 13px per rem (level $level)', ({ level, x }) => {
    expect(levelFromX(x, 0, 13)).toBe(level);
  });

  it.each([
    { level: 0, x: 48 },
    { level: 1, x: 64 },
    { level: 2, x: 80 },
  ])('maps a row indent guide to its own level at 16px per rem (level $level)', ({ level, x }) => {
    expect(levelFromX(x, 0, 16)).toBe(level);
  });

  it('accounts for depthOffset, which strips ancestor levels in focus mode', () => {
    // Focus mode renders level 0 at 1rem = 13px.
    expect(levelFromX(13, 2, 13)).toBe(0);
    expect(levelFromX(39, 2, 13)).toBe(2);
  });

  it('rounds, giving each level a half-step lead-in before its guide', () => {
    // Level 1's guide is 52px; the lead-in makes deeper levels easier to hit.
    expect(levelFromX(46, 0, 13)).toBe(1);
    expect(levelFromX(45, 0, 13)).toBe(0);
  });

  it('returns negative levels left of the shallowest indent', () => {
    // Callers clamp; this does not.
    expect(levelFromX(0, 0, 13)).toBe(-3);
    expect(levelFromX(0, 2, 13)).toBe(-1);
  });
});

describe('getIndentLevel', () => {
  it('reads the level off a collection child', () => {
    expect(getIndentLevel(B1)).toBe(2);
  });

  it('treats a missing item as top level', () => {
    expect(getIndentLevel(null)).toBe(0);
  });

  it('reports pinned requests as top level, matching how they render', () => {
    const pinned = { ...(B1 as CollectionChildFlatItem), kind: 'pinnedRequest' } as unknown as FlatItem;
    expect(getIndentLevel(pinned)).toBe(0);
  });

  it('falls back to top level for a node carrying no level', () => {
    expect(getIndentLevel(emptyFolderNode('e', undefined as unknown as number, 'E'))).toBe(0);
  });
});

describe('resolveDrop — folder trailing edge', () => {
  it('lands inside the folder when the cursor asks to go deeper', () => {
    expect(resolveAt(nestedTree, 'after', 'A', 1).normalized).toMatchObject({ dropPosition: 'on', targetItem: A });
  });

  it('stays beside the folder when the cursor stays at its level', () => {
    const { normalized } = resolveAt(nestedTree, 'after', 'A', 0);
    expect(normalized).toMatchObject({ dropPosition: 'after', targetItem: A });
  });

  it('does not merge into a folder with no visible children', () => {
    const { normalized } = resolveAt([workspaceItem, A, E, C], 'after', 'E', 5);
    expect(normalized).toMatchObject({ dropPosition: 'after', targetItem: E });
  });
});

describe('resolveDrop — first child leading edge', () => {
  // The form react-aria actually renders for the gap above.
  it('keeps the child target when the cursor asks for the child level', () => {
    const { normalized } = resolveAt(nestedTree, 'before', 'A1', 1);
    expect(normalized).toMatchObject({ dropPosition: 'before', targetItem: A1 });
  });

  it('redirects to the parent folder when the cursor goes shallower', () => {
    const { normalized } = resolveAt(nestedTree, 'before', 'A1', 0);
    expect(normalized).toMatchObject({ dropPosition: 'after', targetItem: A });
  });

  it('never redirects shallower than the folder that owns the gap', () => {
    // The gap spans "inside A" to "beside A" only.
    const { normalized } = resolveAt(nestedTree, 'before', 'A1', -5);
    expect(normalized).toMatchObject({ dropPosition: 'after', targetItem: A });
  });
});

describe('resolveDrop — subtree tail', () => {
  it.each([
    { level: 2, expected: 'B1', description: 'deepest — stays inside the subfolder' },
    { level: 1, expected: 'B', description: 'intermediate — inside the containing folder' },
    { level: 0, expected: 'A', description: 'shallowest — beside the containing folder' },
  ])('walks the ancestor chain to level $level ($description)', ({ level, expected }) => {
    const { normalized } = resolveAt(nestedTree, 'after', 'B1', level);
    expect(normalized.targetItem.doc._id).toBe(expected);
  });

  it('clamps a cursor left of the shallow row rather than escaping the gap', () => {
    expect(resolveAt(nestedTree, 'after', 'B1', -4).normalized.targetItem.doc._id).toBe('A');
  });

  it('clamps a cursor past the deep row onto that row', () => {
    expect(resolveAt(nestedTree, 'after', 'B1', 99).normalized.targetItem.doc._id).toBe('B1');
  });
});

describe('resolveDrop — empty folder placeholder', () => {
  it('keeps the placeholder form when landing inside the empty folder', () => {
    const { normalized } = resolveAt(emptyTree, 'before', 'empty_E', 2);
    expect(normalized).toMatchObject({ dropPosition: 'before', targetItem: emptyPlaceholder });
  });

  it('rewrites to the folder trailing edge when landing beside the folder', () => {
    // Also fixes ordering: the placeholder form carries a first-child sort key.
    const { normalized } = resolveAt(emptyTree, 'before', 'empty_E', 1);
    expect(normalized).toMatchObject({ dropPosition: 'after', targetItem: E });
  });
});

describe('resolveDrop — destination parent', () => {
  it('parents on the workspace root at the top of a collection', () => {
    expect(resolveAt(nestedTree, 'before', 'A', 0).parentId).toBe('wrk_1');
  });

  it('parents inside a folder for an "on" drop', () => {
    expect(resolveAt(nestedTree, 'after', 'A', 1).parentId).toBe('A');
  });

  it('parents on the workspace for a top-level sibling insert', () => {
    expect(resolveAt(nestedTree, 'before', 'C', 0).parentId).toBe('wrk_1');
  });

  it('moves a nested request out to the collection top level', () => {
    // Requests may live directly under a collection, with no folder at all.
    expect(resolveAt(nestedTree, 'after', 'B1', 0).parentId).toBe('wrk_1');
    expect(resolveAt(nestedTree, 'after', 'B1', 0).folderName).toBeNull();
  });

  it('parents inside the empty folder when the cursor stays deep', () => {
    expect(resolveAt(emptyTree, 'before', 'empty_E', 2).parentId).toBe('E');
  });

  it('parents outside the empty folder when the cursor goes shallow', () => {
    expect(resolveAt(emptyTree, 'before', 'empty_E', 1).parentId).toBe('A');
  });
});

describe('both raw forms of one gap agree', () => {
  // The invariant the module exists to uphold: react-stately may hand the commit
  // path one form and the render path the other.
  it.each([-2, -1, 0, 1, 2, 3, 10])('subtree tail resolves identically at level %i', level => {
    const viaAfter = resolveAt(nestedTree, 'after', 'B1', level);
    const viaBefore = resolveAt(nestedTree, 'before', 'C', level);
    expect(viaAfter.parentId).toBe(viaBefore.parentId);
    expect(viaAfter.folderName).toBe(viaBefore.folderName);
  });

  it.each([-2, -1, 0, 1, 2, 3, 10])('folder trailing edge resolves identically at level %i', level => {
    const viaAfter = resolveAt(nestedTree, 'after', 'A', level);
    const viaBefore = resolveAt(nestedTree, 'before', 'A1', level);
    expect(viaAfter.parentId).toBe(viaBefore.parentId);
  });

  it.each([-2, -1, 0, 1, 2, 3, 10])('empty folder boundary resolves identically at level %i', level => {
    const viaAfter = resolveAt(emptyTree, 'after', 'E', level);
    const viaBefore = resolveAt(emptyTree, 'before', 'empty_E', level);
    expect(viaAfter.parentId).toBe(viaBefore.parentId);
  });
});

describe('resolveDrop — destination folder name', () => {
  it('names the folder a nested insert actually lands in', () => {
    expect(resolveAt(nestedTree, 'after', 'B1', 2).folderName).toBe('Bravo');
  });

  it('names the containing folder once the cursor steps out one level', () => {
    expect(resolveAt(nestedTree, 'after', 'B1', 1).folderName).toBe('Alpha');
  });

  it('names nothing at top level', () => {
    expect(resolveAt(nestedTree, 'after', 'B1', 0).folderName).toBeNull();
  });

  it('stays silent on a folder trailing edge that did not merge inside', () => {
    expect(resolveAt(nestedTree, 'after', 'A', 0).folderName).toBeNull();
  });

  it('names the folder when the trailing edge did merge inside', () => {
    expect(resolveAt(nestedTree, 'after', 'A', 1).folderName).toBe('Alpha');
  });
});

describe('canDrop', () => {
  const at = (items: FlatItem[], dropPosition: DropPosition, key: string) =>
    boundaryAt(items, dropPosition, key).boundary;
  // canDrop judges containment against the resolved destination.
  const dest = (items: FlatItem[], parentId: string | null) => ({
    parentId,
    parentItem: parentId ? (buildIndex(items).flatItemsById.get(parentId)?.[0] ?? null) : null,
  });

  it('rejects a drop that lands exactly where the item already is', () => {
    expect(canDrop(B1, at(nestedTree, 'after', 'B1'), dest(nestedTree, 'B'))).toBe(false);
  });

  it('allows a drop beside the item when the level changes its parent', () => {
    // Same boundary, cursor moved left: a real move out of the subfolder.
    expect(canDrop(B1, at(nestedTree, 'after', 'B1'), dest(nestedTree, 'A'))).toBe(true);
  });

  it('rejects moving a folder into its own descendant', () => {
    expect(canDrop(B, at(nestedTree, 'on', 'B1'), dest(nestedTree, 'B1'))).toBe(false);
  });

  it('allows moving a request into an unrelated folder', () => {
    expect(canDrop(A1, at(nestedTree, 'on', 'B'), dest(nestedTree, 'B'))).toBe(true);
  });

  it('rejects an "on" drop onto a request rather than a folder', () => {
    expect(canDrop(A1, at(nestedTree, 'on', 'C'), dest(nestedTree, 'wrk_1'))).toBe(false);
  });

  it('allows inserting after an empty-folder placeholder', () => {
    // "after" the placeholder is the gap after the folder it stands in for.
    expect(canDrop(C, at(emptyTree, 'after', 'empty_E'), dest(emptyTree, 'A'))).toBe(true);
  });

  // Self-parenting is unrecoverable: the folder and its subtree vanish.
  it('never lets a folder become its own parent (leading edge of its first child)', () => {
    const resolved = resolveAt(nestedTree, 'before', 'A1', 1);
    expect(resolved.parentId).toBe('A');
    expect(canDrop(A, at(nestedTree, 'before', 'A1'), dest(nestedTree, resolved.parentId))).toBe(false);
  });

  it('never lets a folder become its own parent (its own trailing edge)', () => {
    expect(canDrop(A, at(nestedTree, 'on', 'A'), dest(nestedTree, 'A'))).toBe(false);
  });

  it('never lets a folder land inside its own descendant', () => {
    expect(canDrop(A, at(nestedTree, 'after', 'B1'), dest(nestedTree, 'B'))).toBe(false);
  });

  it('lets a folder escape via the gap below its own subtree', () => {
    // The anchor row (B1) is inside B, but the destination is not.
    expect(canDrop(B, at(nestedTree, 'after', 'B1'), dest(nestedTree, 'wrk_1'))).toBe(true);
  });

  it('allows moving a nested request out to the collection top level', () => {
    // Previous row is a collection child, not the workspace header.
    expect(canDrop(B1, at(nestedTree, 'before', 'C'), dest(nestedTree, 'wrk_1'))).toBe(true);
  });
});

describe('SidebarDropTargetDelegate', () => {
  // Rows 20px tall. `y` arrives already in this space, so scrollOffset must not
  // be added — react-aria measures against the GridList inside the scroller.
  const rows = [
    { key: 'A', index: 0, start: 0, end: 20, size: 20, lane: 0 },
    { key: 'A1', index: 1, start: 20, end: 40, size: 20, lane: 0 },
    { key: 'B', index: 2, start: 40, end: 60, size: 20, lane: 0 },
  ];

  const delegateWith = (scrollOffset: number, rendered = rows) => {
    const virtualizer = { getVirtualItems: () => rendered, scrollOffset } as never;
    const delegate = new SidebarDropTargetDelegate(virtualizer);
    delegate.configure(0, () => {});
    return delegate;
  };

  const acceptBeforeAfter = (target: { type: string; dropPosition?: string }) =>
    target.type === 'item' && target.dropPosition !== 'on';

  it('hit-tests against y directly when unscrolled', () => {
    expect(delegateWith(0).getDropTargetFromPoint(40, 45, acceptBeforeAfter)).toMatchObject({ key: 'B' });
  });

  it('ignores scrollOffset — y is already in content space', () => {
    // y is near the top on purpose: double-counting lands past every row.
    for (const scrollOffset of [0, 100, 5000]) {
      expect(delegateWith(scrollOffset).getDropTargetFromPoint(40, 5, acceptBeforeAfter)).toMatchObject({ key: 'A' });
    }
  });

  it('resolves the row under the cursor rather than the last rendered row', () => {
    const scrolled = [
      { key: 'X', index: 10, start: 200, end: 220, size: 20, lane: 0 },
      { key: 'Y', index: 11, start: 220, end: 240, size: 20, lane: 0 },
    ];
    expect(delegateWith(200, scrolled).getDropTargetFromPoint(40, 205, acceptBeforeAfter)).toMatchObject({ key: 'X' });
  });

  it('falls back to root when nothing is rendered', () => {
    expect(delegateWith(0, []).getDropTargetFromPoint(40, 45, acceptBeforeAfter)).toEqual({ type: 'root' });
  });
});

describe('dropping at the very top of a collection', () => {
  // The only boundary anchored on the collection header, so it takes its own
  // path through canDrop — including on cloud-synced projects.
  const topGap = (remoteId: string | null) => {
    const cloudProject = { _id: 'proj_1', remoteId, name: 'P' } as unknown as ProjectWithGitRepository;
    const withProject = (item: FlatItem) => ({ ...item, project: cloudProject }) as FlatItem;
    const items = [workspaceItem, A, C].map(withProject);
    const [wsRow, folderRow, requestRow] = items;
    const { flatItemsById, lookup, hasVisibleChildren } = buildIndex(items);
    const boundary: BoundaryTargets = {
      dropPosition: 'before',
      targetItem: folderRow,
      realTargetItem: wsRow,
      nextItem: requestRow,
    };
    const ctx: DropContext = { hasVisibleChildren, lookup, flatItemsById, preferredLevel: 0 };
    return { dragged: requestRow, boundary, resolved: resolveDrop(boundary, ctx) };
  };

  it.each([
    { kind: 'local', remoteId: null },
    { kind: 'cloud-synced', remoteId: 'remote_1' },
  ])('parents on the collection itself ($kind project)', ({ remoteId }) => {
    expect(topGap(remoteId).resolved.parentId).toBe('wrk_1');
  });

  it.each([
    { kind: 'local', remoteId: null },
    { kind: 'cloud-synced', remoteId: 'remote_1' },
  ])('allows the drop ($kind project)', ({ remoteId }) => {
    const { dragged, boundary, resolved } = topGap(remoteId);
    expect(canDrop(dragged, boundary, resolved)).toBe(true);
  });
});

describe('the region below an empty folder placeholder', () => {
  //   folder A          level 0
  //     subfolder E     level 1   (expanded, empty)
  //       "Folder empty"          (placeholder)
  //     subfolder S     level 1   <- want to drop above this
  //     request R       level 1
  const S = child({ id: 'S', level: 1, parentId: 'A', ancestors: ['A'], folder: true, metaSortKey: 300, name: 'Sierra' });
  const R = child({ id: 'R', level: 1, parentId: 'A', ancestors: ['A'], metaSortKey: 400 });
  const tree: FlatItem[] = [workspaceItem, A, E, emptyPlaceholder, S, R];

  const resolveHere = (dropPosition: DropPosition, key: string, preferredLevel: number) => {
    const { boundary, flatItemsById, lookup, hasVisibleChildren } = boundaryAt(tree, dropPosition, key);
    const ctx: DropContext = { hasVisibleChildren, lookup, flatItemsById, preferredLevel };
    const resolved = resolveDrop(boundary, ctx);
    return { ...resolved, valid: canDrop(R, boundary, resolved) };
  };

  it.each([0, 1])('accepts a drop below the placeholder, shallow cursor (L%i)', level => {
    // Both raw forms of that one gap.
    for (const [dropPosition, key] of [['after', 'empty_E'], ['before', 'S']] as const) {
      const resolved = resolveHere(dropPosition, key, level);
      expect({ dropPosition, ...resolved }).toMatchObject({ parentId: 'A', valid: true });
    }
  });

  it('means one thing regardless of cursor depth', () => {
    // Not level-aware: the opposite raw form cannot express "inside".
    for (const level of [0, 1, 2, 5]) {
      expect(resolveHere('after', 'empty_E', level)).toMatchObject({ parentId: 'A', valid: true });
    }
  });

  it('agrees across both raw forms at every level', () => {
    for (const level of [-1, 0, 1, 2, 3]) {
      expect(resolveHere('after', 'empty_E', level).parentId).toBe(resolveHere('before', 'S', level).parentId);
    }
  });

  it('still refuses to insert beside an empty COLLECTION placeholder', () => {
    const emptyCollection = {
      ...emptyFolderNode('empty_ws', 0, 'wrk_1'),
      kind: 'emptyCollection',
      requestGroup: undefined,
    } as unknown as FlatItem;
    const items: FlatItem[] = [workspaceItem, emptyCollection];
    const { boundary, flatItemsById, lookup, hasVisibleChildren } = boundaryAt(items, 'after', 'empty_ws');
    const ctx: DropContext = { hasVisibleChildren, lookup, flatItemsById, preferredLevel: 0 };
    expect(canDrop(R, boundary, resolveDrop(boundary, ctx))).toBe(false);
  });
});
