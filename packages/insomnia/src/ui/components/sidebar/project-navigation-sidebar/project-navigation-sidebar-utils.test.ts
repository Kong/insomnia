import { services } from 'insomnia-data';
import { beforeEach, describe, expect, it } from 'vitest';

import { database as db } from '~/common/database';

import {
  type AllRequestsAndMetaInWorkspace,
  filterCollection,
  flattenCollectionChildren,
  getAllRequestsAndMetaByWorkspace,
  getWorkspacesByProjectIds,
} from './project-navigation-sidebar-utils';

// ── Helpers for pure-function test fixtures ───────────────────────────────

type AnyDoc = AllRequestsAndMetaInWorkspace['allRequests'][number];
type AnyMeta = AllRequestsAndMetaInWorkspace['allRequestMetas'][number];
type FolderMeta = AllRequestsAndMetaInWorkspace['requestGroupMetas'][number];

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

// ── DB-backed tests ────────────────────────────────────────────────────────

describe('getWorkspacesByProjectIds', () => {
  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
  });

  it('returns an empty workspace list for a project with no workspaces', async () => {
    const result = await getWorkspacesByProjectIds(['proj_empty']);
    expect(result.get('proj_empty')).toEqual([]);
  });

  it('groups workspaces under the correct project', async () => {
    await services.workspace.create({ _id: 'wrk_a', name: 'A', parentId: 'proj_1', scope: 'collection' });
    await services.workspace.create({ _id: 'wrk_b', name: 'B', parentId: 'proj_1', scope: 'design' });
    await services.workspace.create({ _id: 'wrk_c', name: 'C', parentId: 'proj_2', scope: 'collection' });

    const result = await getWorkspacesByProjectIds(['proj_1', 'proj_2']);

    const proj1Ids = result.get('proj_1')!.map(w => w._id);
    expect(proj1Ids).toHaveLength(2);
    expect(proj1Ids).toEqual(expect.arrayContaining(['wrk_a', 'wrk_b']));

    expect(result.get('proj_2')!.map(w => w._id)).toEqual(['wrk_c']);
  });

  it('does not include workspaces belonging to unqueried projects', async () => {
    await services.workspace.create({ _id: 'wrk_other', name: 'Other', parentId: 'proj_other', scope: 'collection' });

    const result = await getWorkspacesByProjectIds(['proj_1']);

    expect(result.get('proj_1')).toEqual([]);
    expect(result.has('proj_other')).toBe(false);
  });

  it('returns an entry for every requested project ID even when some have no workspaces', async () => {
    await services.workspace.create({ _id: 'wrk_x', name: 'X', parentId: 'proj_has_ws', scope: 'collection' });

    const result = await getWorkspacesByProjectIds(['proj_has_ws', 'proj_no_ws']);

    expect(result.get('proj_has_ws')).toHaveLength(1);
    expect(result.get('proj_no_ws')).toEqual([]);
  });
});

describe('getAllRequestsAndMetaByWorkspace', () => {
  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
  });

  it('returns empty collections for a workspace with no requests', async () => {
    const result = await getAllRequestsAndMetaByWorkspace(['wrk_empty']);
    const data = result.get('wrk_empty')!;

    expect(data.allRequests).toHaveLength(0);
    expect(data.allRequestMetas).toHaveLength(0);
    expect(data.requestGroupMetas).toHaveLength(0);
  });

  it('returns requests that are direct children of the workspace', async () => {
    await services.request.create({ _id: 'req_1', name: 'R1', parentId: 'wrk_1' });
    await services.request.create({ _id: 'req_2', name: 'R2', parentId: 'wrk_1' });

    const ids = (await getAllRequestsAndMetaByWorkspace(['wrk_1'])).get('wrk_1')!.allRequests.map(r => r._id);

    expect(ids).toContain('req_1');
    expect(ids).toContain('req_2');
  });

  it('returns requests nested inside a request group', async () => {
    await services.requestGroup.create({ _id: 'fld_1', name: 'Folder', parentId: 'wrk_1' });
    await services.request.create({ _id: 'req_nested', name: 'Nested', parentId: 'fld_1' });

    const ids = (await getAllRequestsAndMetaByWorkspace(['wrk_1'])).get('wrk_1')!.allRequests.map(r => r._id);

    expect(ids).toContain('fld_1');
    expect(ids).toContain('req_nested');
  });

  it('traverses multiple levels of nesting', async () => {
    await services.requestGroup.create({ _id: 'fld_l1', name: 'L1', parentId: 'wrk_1' });
    await services.requestGroup.create({ _id: 'fld_l2', name: 'L2', parentId: 'fld_l1' });
    await services.request.create({ _id: 'req_deep', name: 'Deep', parentId: 'fld_l2' });

    const ids = (await getAllRequestsAndMetaByWorkspace(['wrk_1'])).get('wrk_1')!.allRequests.map(r => r._id);

    expect(ids).toContain('fld_l1');
    expect(ids).toContain('fld_l2');
    expect(ids).toContain('req_deep');
  });

  it('does not mix requests across workspaces', async () => {
    await services.request.create({ _id: 'req_a', name: 'In A', parentId: 'wrk_A' });
    await services.request.create({ _id: 'req_b', name: 'In B', parentId: 'wrk_B' });

    const result = await getAllRequestsAndMetaByWorkspace(['wrk_A', 'wrk_B']);

    const aIds = result.get('wrk_A')!.allRequests.map(r => r._id);
    const bIds = result.get('wrk_B')!.allRequests.map(r => r._id);

    expect(aIds).toContain('req_a');
    expect(aIds).not.toContain('req_b');
    expect(bIds).toContain('req_b');
    expect(bIds).not.toContain('req_a');
  });

  it('includes request meta for requests in the workspace', async () => {
    await services.request.create({ _id: 'req_pin', name: 'Pinned', parentId: 'wrk_1' });
    await services.requestMeta.create({ parentId: 'req_pin', pinned: true });

    const data = (await getAllRequestsAndMetaByWorkspace(['wrk_1'])).get('wrk_1')!;
    const meta = data.allRequestMetas.find(m => m.parentId === 'req_pin');

    expect(meta?.pinned).toBe(true);
  });

  it('includes request group meta for folders in the workspace', async () => {
    await services.requestGroup.create({ _id: 'fld_col', name: 'Collapsed', parentId: 'wrk_1' });
    await services.requestGroupMeta.create({ parentId: 'fld_col', collapsed: true });

    const data = (await getAllRequestsAndMetaByWorkspace(['wrk_1'])).get('wrk_1')!;
    const meta = data.requestGroupMetas.find(m => m.parentId === 'fld_col');

    expect(meta?.collapsed).toBe(true);
  });
});

// ── Pure-function tests ────────────────────────────────────────────────────

describe('flattenCollectionChildren', () => {
  const WS = 'wrk_test';

  it('returns an empty array when there are no requests', () => {
    const data: AllRequestsAndMetaInWorkspace = { allRequests: [], allRequestMetas: [], requestGroupMetas: [] };
    expect(flattenCollectionChildren(WS, false, data)).toEqual([]);
  });

  it('returns top-level requests when the workspace is not collapsed', () => {
    const data: AllRequestsAndMetaInWorkspace = {
      allRequests: [mkReq('req_1', WS), mkReq('req_2', WS)],
      allRequestMetas: [],
      requestGroupMetas: [],
    };
    const ids = flattenCollectionChildren(WS, false, data).map(c => c.doc._id);

    expect(ids).toEqual(expect.arrayContaining(['req_1', 'req_2']));
  });

  it('marks direct workspace children hidden when the workspace is collapsed', () => {
    const data: AllRequestsAndMetaInWorkspace = {
      allRequests: [mkReq('req_1', WS), mkFolder('fld_1', WS), mkReq('req_2', 'fld_1')],
      allRequestMetas: [],
      requestGroupMetas: [],
    };
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
    const data: AllRequestsAndMetaInWorkspace = {
      allRequests: [mkFolder('fld_parent', WS), mkFolder('fld_child', 'fld_parent'), mkReq('req_deep', 'fld_child')],
      allRequestMetas: [],
      requestGroupMetas: [mkFolderMeta('fld_parent', true)],
    };
    const result = flattenCollectionChildren(WS, false, data);
    const byId = Object.fromEntries(result.map(c => [c.doc._id, c]));

    expect(byId['fld_parent'].collapsed).toBe(true);
    expect(byId['fld_parent'].hidden).toBe(false);
    expect(byId['fld_child'].hidden).toBe(true);
    expect(byId['fld_child'].collapsed).toBe(true);
    expect(byId['req_deep'].hidden).toBe(true);
  });

  it('places a folder before its children in the flat list', () => {
    const data: AllRequestsAndMetaInWorkspace = {
      allRequests: [mkFolder('fld_1', WS), mkReq('req_1', 'fld_1')],
      allRequestMetas: [],
      requestGroupMetas: [],
    };
    const ids = flattenCollectionChildren(WS, false, data).map(c => c.doc._id);

    expect(ids.indexOf('fld_1')).toBeLessThan(ids.indexOf('req_1'));
  });

  it('assigns correct nesting levels for each depth', () => {
    const data: AllRequestsAndMetaInWorkspace = {
      allRequests: [mkFolder('fld_1', WS), mkFolder('fld_2', 'fld_1'), mkReq('req_1', 'fld_2')],
      allRequestMetas: [],
      requestGroupMetas: [],
    };
    const result = flattenCollectionChildren(WS, false, data);
    const byId = Object.fromEntries(result.map(c => [c.doc._id, c]));

    expect(byId['fld_1'].level).toBe(0);
    expect(byId['fld_2'].level).toBe(1);
    expect(byId['req_1'].level).toBe(2);
  });

  it('populates the ancestors array for nested items', () => {
    const data: AllRequestsAndMetaInWorkspace = {
      allRequests: [mkFolder('fld_1', WS), mkFolder('fld_2', 'fld_1'), mkReq('req_1', 'fld_2')],
      allRequestMetas: [],
      requestGroupMetas: [],
    };
    const result = flattenCollectionChildren(WS, false, data);
    const byId = Object.fromEntries(result.map(c => [c.doc._id, c]));

    expect(byId['req_1'].ancestors).toEqual(expect.arrayContaining(['fld_1', 'fld_2']));
    expect(byId['fld_2'].ancestors).toContain('fld_1');
    expect(byId['fld_1'].ancestors).toEqual([]);
  });

  it('hides children of a collapsed folder', () => {
    const data: AllRequestsAndMetaInWorkspace = {
      allRequests: [mkFolder('fld_1', WS), mkReq('req_1', 'fld_1'), mkReq('req_2', 'fld_1')],
      allRequestMetas: [],
      requestGroupMetas: [mkFolderMeta('fld_1', true)],
    };
    const result = flattenCollectionChildren(WS, false, data);
    const byId = Object.fromEntries(result.map(c => [c.doc._id, c]));

    expect(byId['fld_1'].collapsed).toBe(true);
    expect(byId['fld_1'].hidden).toBe(false);
    expect(byId['req_1'].hidden).toBe(true);
    expect(byId['req_2'].hidden).toBe(true);
  });

  it('does not hide children of an expanded folder', () => {
    const data: AllRequestsAndMetaInWorkspace = {
      allRequests: [mkFolder('fld_1', WS), mkReq('req_1', 'fld_1')],
      allRequestMetas: [],
      requestGroupMetas: [mkFolderMeta('fld_1', false)],
    };
    const result = flattenCollectionChildren(WS, false, data);
    const byId = Object.fromEntries(result.map(c => [c.doc._id, c]));

    expect(byId['fld_1'].collapsed).toBe(false);
    expect(byId['req_1'].hidden).toBe(false);
  });

  it('marks a request as pinned when its meta has pinned=true', () => {
    const data: AllRequestsAndMetaInWorkspace = {
      allRequests: [mkReq('req_pinned', WS)],
      allRequestMetas: [mkReqMeta('req_pinned', true)],
      requestGroupMetas: [],
    };
    const [item] = flattenCollectionChildren(WS, false, data);

    expect(item.pinned).toBe(true);
  });

  it('never marks a request group as pinned', () => {
    const data: AllRequestsAndMetaInWorkspace = {
      allRequests: [mkFolder('fld_1', WS)],
      allRequestMetas: [],
      requestGroupMetas: [],
    };
    const [item] = flattenCollectionChildren(WS, false, data);

    expect(item.pinned).toBe(false);
  });

  it('populates the children array for request groups', () => {
    const data: AllRequestsAndMetaInWorkspace = {
      allRequests: [mkFolder('fld_1', WS), mkReq('req_1', 'fld_1'), mkReq('req_2', 'fld_1')],
      allRequestMetas: [],
      requestGroupMetas: [],
    };
    const result = flattenCollectionChildren(WS, false, data);
    const folder = result.find(c => c.doc._id === 'fld_1')!;

    expect(folder.children.map(c => c.doc._id)).toEqual(expect.arrayContaining(['req_1', 'req_2']));
  });

  it('sorts folder children by metaSortKey ascending', () => {
    const data: AllRequestsAndMetaInWorkspace = {
      allRequests: [
        mkFolder('fld_1', WS),
        mkReq('req_last', 'fld_1', { metaSortKey: 300 }),
        mkReq('req_first', 'fld_1', { metaSortKey: 100 }),
        mkReq('req_mid', 'fld_1', { metaSortKey: 200 }),
      ],
      allRequestMetas: [],
      requestGroupMetas: [],
    };
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
