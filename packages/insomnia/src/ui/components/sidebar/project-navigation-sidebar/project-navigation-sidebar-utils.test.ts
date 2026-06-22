import { describe, expect, it } from 'vitest';

import type { CollectionWorkspaceChildren } from '~/ui/hooks/data/workspace-children';

import { filterCollection, flattenCollectionChildren } from './project-navigation-sidebar-utils';

// ── Helpers for pure-function test fixtures ───────────────────────────────

type AnyDoc = CollectionWorkspaceChildren['children']['requestsAndGroups'][number];
type AnyMeta = CollectionWorkspaceChildren['childrenMetas']['allRequestMetas'][number];
type FolderMeta = CollectionWorkspaceChildren['childrenMetas']['requestGroupMetas'][number];

const mkReq = (id: string, parentId: string, extra: Record<string, unknown> = {}): AnyDoc =>
  ({
    _id: id,
    type: 'Request',
    parentId,
    name: `${id}-name`,
    url: '',
    method: 'GET',
    metaSortKey: 0,
    isPrivate: false,
    description: '',
    created: 0,
    modified: 0,
    ...extra,
  }) as unknown as AnyDoc;

const mkFolder = (id: string, parentId: string, extra: Record<string, unknown> = {}): AnyDoc =>
  ({
    _id: id,
    type: 'RequestGroup',
    parentId,
    name: `${id}-name`,
    metaSortKey: 0,
    isPrivate: false,
    description: '',
    created: 0,
    modified: 0,
    ...extra,
  }) as unknown as AnyDoc;

const mkReqMeta = (parentId: string, pinned = false): AnyMeta =>
  ({ _id: `meta_${parentId}`, type: 'RequestMeta', parentId, pinned }) as unknown as AnyMeta;

const mkFolderMeta = (parentId: string, collapsed = false): FolderMeta =>
  ({ _id: `fmeta_${parentId}`, type: 'RequestGroupMeta', parentId, collapsed }) as unknown as FolderMeta;

// Build the CollectionWorkspaceChildren shape consumed by flattenCollectionChildren.
const mkChildren = (
  requestsAndGroups: AnyDoc[],
  allRequestMetas: AnyMeta[] = [],
  requestGroupMetas: FolderMeta[] = [],
): CollectionWorkspaceChildren => ({
  children: { requestsAndGroups },
  childrenMetas: { allRequestMetas, requestGroupMetas },
});

// filterCollection works on Child[] – create minimal compatible objects
type ChildLike = Parameters<typeof filterCollection>[0][number];

const mkChild = (
  id: string,
  name: string,
  ancestors: string[] = [],
  extra: { url?: string; description?: string } = {},
): ChildLike => ({
  doc: { _id: id, type: 'Request', name, url: extra.url ?? '', description: extra.description ?? '' } as any,
  hidden: false,
  collapsed: false,
  pinned: false,
  level: 0,
  ancestors,
  children: [],
});

const mkFolderChild = (
  id: string,
  name: string,
  ancestors: string[] = [],
  extra: { collapsed?: boolean } = {},
): ChildLike => ({
  doc: { _id: id, type: 'RequestGroup', name, description: '' } as any,
  hidden: false,
  collapsed: extra.collapsed ?? false,
  pinned: false,
  level: 0,
  ancestors,
  children: [],
});

// ── Pure-function tests ────────────────────────────────────────────────────

describe('flattenCollectionChildren', () => {
  const WS = 'wrk_test';

  it('returns an empty array when there are no requests', () => {
    expect(flattenCollectionChildren(WS, false, mkChildren([]))).toEqual([]);
  });

  it('returns top-level requests when the workspace is not collapsed', () => {
    const data = mkChildren([mkReq('req_1', WS), mkReq('req_2', WS)]);
    const ids = flattenCollectionChildren(WS, false, data).map(c => c.doc._id);

    expect(ids).toEqual(expect.arrayContaining(['req_1', 'req_2']));
  });

  it('marks direct workspace children hidden when the workspace is collapsed', () => {
    const data = mkChildren([mkReq('req_1', WS), mkFolder('fld_1', WS), mkReq('req_2', 'fld_1')]);
    const result = flattenCollectionChildren(WS, true, data);
    const byId = Object.fromEntries(result.map(c => [c.doc._id, c]));

    // root items are directly hidden by the collapsed workspace
    expect(byId['req_1'].hidden).toBe(true);
    expect(byId['fld_1'].hidden).toBe(true);
    // fld_1 inherits collapsed=true from the workspace, so req_2 inside it is also hidden
    expect(byId['req_2'].hidden).toBe(true);
  });

  it('hides grandchildren when a parent folder is collapsed even if the child folder has no collapsed meta', () => {
    // Bug: before the fix, fld_child had collapsed=false (no meta), so req_deep got
    // parentIsCollapsed=false and was incorrectly visible despite fld_parent being collapsed.
    const data = mkChildren(
      [mkFolder('fld_parent', WS), mkFolder('fld_child', 'fld_parent'), mkReq('req_deep', 'fld_child')],
      [],
      [mkFolderMeta('fld_parent', true)],
    );
    const result = flattenCollectionChildren(WS, false, data);
    const byId = Object.fromEntries(result.map(c => [c.doc._id, c]));

    expect(byId['fld_parent'].collapsed).toBe(true);
    expect(byId['fld_parent'].hidden).toBe(false);
    expect(byId['fld_child'].hidden).toBe(true);
    expect(byId['fld_child'].collapsed).toBe(true);
    expect(byId['req_deep'].hidden).toBe(true);
  });

  it('places a folder before its children in the flat list', () => {
    const data = mkChildren([mkFolder('fld_1', WS), mkReq('req_1', 'fld_1')]);
    const ids = flattenCollectionChildren(WS, false, data).map(c => c.doc._id);

    expect(ids.indexOf('fld_1')).toBeLessThan(ids.indexOf('req_1'));
  });

  it('assigns correct nesting levels for each depth', () => {
    const data = mkChildren([mkFolder('fld_1', WS), mkFolder('fld_2', 'fld_1'), mkReq('req_1', 'fld_2')]);
    const result = flattenCollectionChildren(WS, false, data);
    const byId = Object.fromEntries(result.map(c => [c.doc._id, c]));

    expect(byId['fld_1'].level).toBe(0);
    expect(byId['fld_2'].level).toBe(1);
    expect(byId['req_1'].level).toBe(2);
  });

  it('populates the ancestors array for nested items', () => {
    const data = mkChildren([mkFolder('fld_1', WS), mkFolder('fld_2', 'fld_1'), mkReq('req_1', 'fld_2')]);
    const result = flattenCollectionChildren(WS, false, data);
    const byId = Object.fromEntries(result.map(c => [c.doc._id, c]));

    expect(byId['req_1'].ancestors).toEqual(expect.arrayContaining(['fld_1', 'fld_2']));
    expect(byId['fld_2'].ancestors).toContain('fld_1');
    expect(byId['fld_1'].ancestors).toEqual([]);
  });

  it('hides children of a collapsed folder', () => {
    const data = mkChildren(
      [mkFolder('fld_1', WS), mkReq('req_1', 'fld_1'), mkReq('req_2', 'fld_1')],
      [],
      [mkFolderMeta('fld_1', true)],
    );
    const result = flattenCollectionChildren(WS, false, data);
    const byId = Object.fromEntries(result.map(c => [c.doc._id, c]));

    expect(byId['fld_1'].collapsed).toBe(true);
    expect(byId['fld_1'].hidden).toBe(false);
    expect(byId['req_1'].hidden).toBe(true);
    expect(byId['req_2'].hidden).toBe(true);
  });

  it('does not hide children of an expanded folder', () => {
    const data = mkChildren([mkFolder('fld_1', WS), mkReq('req_1', 'fld_1')], [], [mkFolderMeta('fld_1', false)]);
    const result = flattenCollectionChildren(WS, false, data);
    const byId = Object.fromEntries(result.map(c => [c.doc._id, c]));

    expect(byId['fld_1'].collapsed).toBe(false);
    expect(byId['req_1'].hidden).toBe(false);
  });

  it('marks a request as pinned when its meta has pinned=true', () => {
    const data = mkChildren([mkReq('req_pinned', WS)], [mkReqMeta('req_pinned', true)]);
    const [item] = flattenCollectionChildren(WS, false, data);

    expect(item.pinned).toBe(true);
  });

  it('never marks a request group as pinned', () => {
    const data = mkChildren([mkFolder('fld_1', WS)]);
    const [item] = flattenCollectionChildren(WS, false, data);

    expect(item.pinned).toBe(false);
  });

  it('populates the children array for request groups', () => {
    const data = mkChildren([mkFolder('fld_1', WS), mkReq('req_1', 'fld_1'), mkReq('req_2', 'fld_1')]);
    const result = flattenCollectionChildren(WS, false, data);
    const folder = result.find(c => c.doc._id === 'fld_1')!;

    expect(folder.children.map(c => c.doc._id)).toEqual(expect.arrayContaining(['req_1', 'req_2']));
  });

  it('sorts folder children by metaSortKey ascending', () => {
    const data = mkChildren([
      mkFolder('fld_1', WS),
      mkReq('req_last', 'fld_1', { metaSortKey: 300 }),
      mkReq('req_first', 'fld_1', { metaSortKey: 100 }),
      mkReq('req_mid', 'fld_1', { metaSortKey: 200 }),
    ]);
    const result = flattenCollectionChildren(WS, false, data);
    const childIds = result.filter(c => c.doc.parentId === 'fld_1').map(c => c.doc._id);

    expect(childIds).toEqual(['req_first', 'req_mid', 'req_last']);
  });
});

// ── filterCollection ───────────────────────────────────────────────────────

describe('filterCollection', () => {
  it('returns the collection unchanged (same reference) when filter is empty', () => {
    const collection = [mkChild('req_1', 'Get User'), mkChild('req_2', 'Post User')];
    expect(filterCollection(collection, '')).toBe(collection);
  });

  it('hides items whose name does not match the filter', () => {
    const collection = [mkChild('req_1', 'Get User'), mkChild('req_2', 'Post User')];
    const result = filterCollection(collection, 'Get');

    const byId = Object.fromEntries(result.map(c => [c.doc._id, c]));
    expect(byId['req_1'].hidden).toBe(false);
    expect(byId['req_2'].hidden).toBe(true);
  });

  it('hides all items when nothing matches', () => {
    const collection = [mkChild('req_1', 'Get User'), mkChild('req_2', 'Post User')];
    expect(filterCollection(collection, 'zzz_no_match').every(c => c.hidden)).toBe(true);
  });

  it('reveals an ancestor folder when a descendant matches', () => {
    const collection = [mkFolderChild('fld_1', 'Auth Folder'), mkChild('req_1', 'Login Request', ['fld_1'])];
    const result = filterCollection(collection, 'Login');
    const byId = Object.fromEntries(result.map(c => [c.doc._id, c]));

    expect(byId['req_1'].hidden).toBe(false);
    expect(byId['fld_1'].hidden).toBe(false);
  });

  it('matches against the description field', () => {
    const collection = [
      mkChild('req_1', 'Untitled', [], { description: 'creates a new user account' }),
      mkChild('req_2', 'Other', [], { description: 'fetches a list of posts' }),
    ];
    const result = filterCollection(collection, 'user account');
    const byId = Object.fromEntries(result.map(c => [c.doc._id, c]));

    expect(byId['req_1'].hidden).toBe(false);
    expect(byId['req_2'].hidden).toBe(true);
  });

  it('matches against the URL field for request items', () => {
    const collection = [
      mkChild('req_1', 'Untitled', [], { url: 'https://api.example.com/users' }),
      mkChild('req_2', 'Untitled', [], { url: 'https://api.example.com/posts' }),
    ];
    const result = filterCollection(collection, '/users');
    const byId = Object.fromEntries(result.map(c => [c.doc._id, c]));

    expect(byId['req_1'].hidden).toBe(false);
    expect(byId['req_2'].hidden).toBe(true);
  });

  it('does not match folder items against the URL field', () => {
    // Folders have no URL — filtering should only check name/description for them
    const collection = [mkFolderChild('fld_url', '/special-path'), mkFolderChild('fld_other', 'Other Folder')];
    const result = filterCollection(collection, '/special-path');
    const byId = Object.fromEntries(result.map(c => [c.doc._id, c]));

    // Matches on name (not URL), so this should still be visible
    expect(byId['fld_url'].hidden).toBe(false);
    expect(byId['fld_other'].hidden).toBe(true);
  });

  it('sets collapsed to false on every item regardless of match', () => {
    const collection = [
      mkFolderChild('fld_1', 'Auth Folder', [], { collapsed: true }),
      mkChild('req_1', 'Login Request', ['fld_1']),
      mkChild('req_2', 'Unrelated Request'),
    ];
    const result = filterCollection(collection, 'Login');

    expect(result.every(c => c.collapsed === false)).toBe(true);
  });
});
