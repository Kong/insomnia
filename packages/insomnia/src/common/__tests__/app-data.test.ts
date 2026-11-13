import { QueryClient } from '@tanstack/react-query';
import type * as InsomniaData from 'insomnia-data';
import type {
  ApiSpec,
  BaseModel,
  ChangeBufferEvent,
  CollectionWorkspaceChildren,
  OrganizationData,
} from 'insomnia-data';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { organizationDataKeys, workspaceChildrenKeys } from '~/common/app-data';

vi.mock('insomnia-data', async () => {
  const actual = await vi.importActual<typeof InsomniaData>('insomnia-data');
  return {
    ...actual,
    services: {
      appData: {
        getWorkspaceChildren: vi.fn(),
      },
    },
  };
});

import { services } from 'insomnia-data';

import { prefetchUncachedWorkspaceChildren, updateAppDataOnDbChanges } from '../app-data';

function fakeDoc(type: BaseModel['type'], overrides: Partial<BaseModel> = {}): BaseModel {
  return {
    _id: 'id_test',
    type,
    parentId: 'parent_test',
    modified: 0,
    created: 0,
    isPrivate: false,
    name: 'test',
    ...overrides,
  };
}

function fakeApiSpec(overrides: Partial<ApiSpec> = {}): ApiSpec {
  return { ...fakeDoc('ApiSpec', { _id: 'spc_1' }), fileName: 'spec', contentType: 'yaml', contents: '', ...overrides };
}

function change(event: ChangeBufferEvent[0], doc: BaseModel): ChangeBufferEvent {
  return [event, doc, []];
}

describe('updateAppDataOnDbChanges', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity, retry: false } },
    });
  });

  it('invalidates cached organization data when a project is created', () => {
    const organizationId = 'org_1';
    const orgData: OrganizationData = { projects: [], workspaces: [], workspaceMetas: [] };
    queryClient.setQueryData(organizationDataKeys.byOrganizationId(organizationId), orgData);

    const project = fakeDoc('Project', { _id: 'proj_1', parentId: organizationId });
    updateAppDataOnDbChanges(queryClient, [change('insert', project)]);

    expect(queryClient.getQueryState(organizationDataKeys.byOrganizationId(organizationId))?.isInvalidated).toBe(true);
  });

  it('invalidates both the origin and destination organization when a project moves parents', () => {
    const organizationAId = 'org_a';
    const organizationBId = 'org_b';
    const project = { _id: 'proj_1', parentId: organizationAId } as OrganizationData['projects'][0];
    const orgDataA: OrganizationData = { projects: [project], workspaces: [], workspaceMetas: [] };
    const orgDataB: OrganizationData = { projects: [], workspaces: [], workspaceMetas: [] };
    queryClient.setQueryData(organizationDataKeys.byOrganizationId(organizationAId), orgDataA);
    queryClient.setQueryData(organizationDataKeys.byOrganizationId(organizationBId), orgDataB);

    const moved = fakeDoc('Project', { _id: 'proj_1', parentId: organizationBId });
    updateAppDataOnDbChanges(queryClient, [change('update', moved)]);

    expect(queryClient.getQueryState(organizationDataKeys.byOrganizationId(organizationAId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(organizationDataKeys.byOrganizationId(organizationBId))?.isInvalidated).toBe(true);
  });

  it('invalidates the organization matched via project when a workspace changes', () => {
    const organizationId = 'org_1';
    const projectId = 'proj_1';
    const orgData: OrganizationData = {
      projects: [{ _id: projectId, parentId: organizationId } as OrganizationData['projects'][0]],
      workspaces: [],
      workspaceMetas: [],
    };
    queryClient.setQueryData(organizationDataKeys.byOrganizationId(organizationId), orgData);

    const workspace = fakeDoc('Workspace', { _id: 'wrk_1', parentId: projectId });
    updateAppDataOnDbChanges(queryClient, [change('insert', workspace)]);

    expect(queryClient.getQueryState(organizationDataKeys.byOrganizationId(organizationId))?.isInvalidated).toBe(true);
  });

  it('adds a new workspaceMeta to cached organization data in place, without invalidating', () => {
    const organizationId = 'org_1';
    const workspaceId = 'wrk_1';
    const orgData: OrganizationData = {
      projects: [],
      workspaces: [{ _id: workspaceId } as OrganizationData['workspaces'][0]],
      workspaceMetas: [],
    };
    queryClient.setQueryData(organizationDataKeys.byOrganizationId(organizationId), orgData);

    const workspaceMeta = fakeDoc('WorkspaceMeta', { _id: 'wrkMeta_1', parentId: workspaceId });
    updateAppDataOnDbChanges(queryClient, [change('insert', workspaceMeta)]);

    const updated = queryClient.getQueryData<OrganizationData>(organizationDataKeys.byOrganizationId(organizationId));
    expect(updated?.workspaceMetas.map(wm => wm._id)).toContain('wrkMeta_1');
    expect(queryClient.getQueryState(organizationDataKeys.byOrganizationId(organizationId))?.isInvalidated).toBe(false);
  });

  it('patches an existing workspaceMeta in cached organization data in place', () => {
    const organizationId = 'org_1';
    const workspaceId = 'wrk_1';
    const orgData: OrganizationData = {
      projects: [],
      workspaces: [{ _id: workspaceId } as OrganizationData['workspaces'][0]],
      workspaceMetas: [
        fakeDoc('WorkspaceMeta', { _id: 'wrkMeta_1', parentId: workspaceId }) as OrganizationData['workspaceMetas'][0],
      ],
    };
    queryClient.setQueryData(organizationDataKeys.byOrganizationId(organizationId), orgData);

    const updatedMeta = fakeDoc('WorkspaceMeta', { _id: 'wrkMeta_1', parentId: workspaceId, name: 'renamed' });
    updateAppDataOnDbChanges(queryClient, [change('update', updatedMeta)]);

    const updated = queryClient.getQueryData<OrganizationData>(organizationDataKeys.byOrganizationId(organizationId));
    expect(updated?.workspaceMetas.find(wm => wm._id === 'wrkMeta_1')?.name).toBe('renamed');
  });

  it('removes a deleted workspaceMeta from cached organization data in place', () => {
    const organizationId = 'org_1';
    const workspaceId = 'wrk_1';
    const orgData: OrganizationData = {
      projects: [],
      workspaces: [{ _id: workspaceId } as OrganizationData['workspaces'][0]],
      workspaceMetas: [
        fakeDoc('WorkspaceMeta', { _id: 'wrkMeta_1', parentId: workspaceId }) as OrganizationData['workspaceMetas'][0],
      ],
    };
    queryClient.setQueryData(organizationDataKeys.byOrganizationId(organizationId), orgData);

    const removedMeta = fakeDoc('WorkspaceMeta', { _id: 'wrkMeta_1', parentId: workspaceId });
    updateAppDataOnDbChanges(queryClient, [change('remove', removedMeta)]);

    const updated = queryClient.getQueryData<OrganizationData>(organizationDataKeys.byOrganizationId(organizationId));
    expect(updated?.workspaceMetas.map(wm => wm._id)).not.toContain('wrkMeta_1');
  });

  it('patches a renamed request in place without invalidating the workspace cache', () => {
    const workspaceId = 'wrk_1';
    const request = fakeDoc('Request', { _id: 'req_1', parentId: workspaceId });
    const collectionChildren: CollectionWorkspaceChildren = {
      data: { requestsAndGroups: [request as CollectionWorkspaceChildren['data']['requestsAndGroups'][0]] },
      dataMetas: { allRequestMetas: [], requestGroupMetas: [] },
    };
    queryClient.setQueryData(workspaceChildrenKeys.byWorkspaceId(workspaceId), collectionChildren);

    const renamed = fakeDoc('Request', { _id: 'req_1', parentId: workspaceId, name: 'renamed' });
    updateAppDataOnDbChanges(queryClient, [change('update', renamed)]);

    const updated = queryClient.getQueryData<CollectionWorkspaceChildren>(
      workspaceChildrenKeys.byWorkspaceId(workspaceId),
    );
    expect(updated?.data.requestsAndGroups.find(r => r._id === 'req_1')?.name).toBe('renamed');
    expect(queryClient.getQueryState(workspaceChildrenKeys.byWorkspaceId(workspaceId))?.isInvalidated).toBe(false);
  });

  it('invalidates both the origin and destination workspace when a request moves parents', () => {
    const workspaceAId = 'wrk_a';
    const workspaceBId = 'wrk_b';
    const request = fakeDoc('Request', { _id: 'req_1', parentId: workspaceAId });
    const childrenA: CollectionWorkspaceChildren = {
      data: { requestsAndGroups: [request as CollectionWorkspaceChildren['data']['requestsAndGroups'][0]] },
      dataMetas: { allRequestMetas: [], requestGroupMetas: [] },
    };
    const childrenB: CollectionWorkspaceChildren = {
      data: { requestsAndGroups: [] },
      dataMetas: { allRequestMetas: [], requestGroupMetas: [] },
    };
    queryClient.setQueryData(workspaceChildrenKeys.byWorkspaceId(workspaceAId), childrenA);
    queryClient.setQueryData(workspaceChildrenKeys.byWorkspaceId(workspaceBId), childrenB);

    const moved = fakeDoc('Request', { _id: 'req_1', parentId: workspaceBId });
    updateAppDataOnDbChanges(queryClient, [change('update', moved)]);

    expect(queryClient.getQueryState(workspaceChildrenKeys.byWorkspaceId(workspaceAId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(workspaceChildrenKeys.byWorkspaceId(workspaceBId))?.isInvalidated).toBe(true);
  });

  it('invalidates the parent workspace when a non-collection child type (mock server) is updated', () => {
    const workspaceId = 'wrk_1';
    queryClient.setQueryData(workspaceChildrenKeys.byWorkspaceId(workspaceId), {
      data: { mockServer: fakeDoc('MockServer', { _id: 'mock_1', parentId: workspaceId }) },
      dataMetas: {},
    });

    const mockServer = fakeDoc('MockServer', { _id: 'mock_1', parentId: workspaceId, name: 'renamed-mock' });
    updateAppDataOnDbChanges(queryClient, [change('update', mockServer)]);

    expect(queryClient.getQueryState(workspaceChildrenKeys.byWorkspaceId(workspaceId))?.isInvalidated).toBe(true);
  });

  it('patches an updated api spec into the cached collection children in place, without invalidating', () => {
    const workspaceId = 'wrk_1';
    const request = fakeDoc('Request', { _id: 'req_1', parentId: workspaceId });
    const requestsAndGroups = [request as CollectionWorkspaceChildren['data']['requestsAndGroups'][0]];
    const collectionChildren: CollectionWorkspaceChildren = {
      data: { apiSpec: fakeApiSpec({ parentId: workspaceId, contents: 'old' }), requestsAndGroups },
      dataMetas: { allRequestMetas: [], requestGroupMetas: [] },
    };
    queryClient.setQueryData(workspaceChildrenKeys.byWorkspaceId(workspaceId), collectionChildren);

    updateAppDataOnDbChanges(queryClient, [
      change('update', fakeApiSpec({ parentId: workspaceId, contents: 'new' })),
    ]);

    const updated = queryClient.getQueryData<CollectionWorkspaceChildren>(
      workspaceChildrenKeys.byWorkspaceId(workspaceId),
    );
    expect(updated?.data.apiSpec?.contents).toBe('new');
    expect(updated?.data.requestsAndGroups).toBe(requestsAndGroups);
    expect(queryClient.getQueryState(workspaceChildrenKeys.byWorkspaceId(workspaceId))?.isInvalidated).toBe(false);
  });

  it('sets the api spec in place when the cached collection children do not have one yet', () => {
    const workspaceId = 'wrk_1';
    queryClient.setQueryData<CollectionWorkspaceChildren>(workspaceChildrenKeys.byWorkspaceId(workspaceId), {
      data: { requestsAndGroups: [] },
      dataMetas: { allRequestMetas: [], requestGroupMetas: [] },
    });

    updateAppDataOnDbChanges(queryClient, [
      change('update', fakeApiSpec({ parentId: workspaceId, contents: 'first' })),
    ]);

    const updated = queryClient.getQueryData<CollectionWorkspaceChildren>(
      workspaceChildrenKeys.byWorkspaceId(workspaceId),
    );
    expect(updated?.data.apiSpec?.contents).toBe('first');
    expect(queryClient.getQueryState(workspaceChildrenKeys.byWorkspaceId(workspaceId))?.isInvalidated).toBe(false);
  });

  it('only patches the workspace that owns the updated api spec', () => {
    const workspaceAId = 'wrk_a';
    const workspaceBId = 'wrk_b';
    const specA = fakeApiSpec({ _id: 'spc_a', parentId: workspaceAId, contents: 'a' });
    const specB = fakeApiSpec({ _id: 'spc_b', parentId: workspaceBId, contents: 'b' });
    const emptyMetas = { allRequestMetas: [], requestGroupMetas: [] };
    queryClient.setQueryData<CollectionWorkspaceChildren>(workspaceChildrenKeys.byWorkspaceId(workspaceAId), {
      data: { apiSpec: specA, requestsAndGroups: [] },
      dataMetas: emptyMetas,
    });
    queryClient.setQueryData<CollectionWorkspaceChildren>(workspaceChildrenKeys.byWorkspaceId(workspaceBId), {
      data: { apiSpec: specB, requestsAndGroups: [] },
      dataMetas: emptyMetas,
    });

    updateAppDataOnDbChanges(queryClient, [change('update', { ...specB, contents: 'b2' } as ApiSpec)]);

    const a = queryClient.getQueryData<CollectionWorkspaceChildren>(workspaceChildrenKeys.byWorkspaceId(workspaceAId));
    const b = queryClient.getQueryData<CollectionWorkspaceChildren>(workspaceChildrenKeys.byWorkspaceId(workspaceBId));
    expect(a?.data.apiSpec).toBe(specA);
    expect(b?.data.apiSpec?.contents).toBe('b2');
  });

  it('invalidates the workspace cache when an api spec is created', () => {
    const workspaceId = 'wrk_1';
    queryClient.setQueryData<CollectionWorkspaceChildren>(workspaceChildrenKeys.byWorkspaceId(workspaceId), {
      data: { requestsAndGroups: [] },
      dataMetas: { allRequestMetas: [], requestGroupMetas: [] },
    });

    updateAppDataOnDbChanges(queryClient, [change('insert', fakeApiSpec({ parentId: workspaceId }))]);

    expect(queryClient.getQueryState(workspaceChildrenKeys.byWorkspaceId(workspaceId))?.isInvalidated).toBe(true);
  });

  it('invalidates the workspace cache when an api spec is removed', () => {
    const workspaceId = 'wrk_1';
    queryClient.setQueryData<CollectionWorkspaceChildren>(workspaceChildrenKeys.byWorkspaceId(workspaceId), {
      data: { apiSpec: fakeApiSpec({ parentId: workspaceId }), requestsAndGroups: [] },
      dataMetas: { allRequestMetas: [], requestGroupMetas: [] },
    });

    updateAppDataOnDbChanges(queryClient, [change('remove', fakeApiSpec({ parentId: workspaceId }))]);

    expect(queryClient.getQueryState(workspaceChildrenKeys.byWorkspaceId(workspaceId))?.isInvalidated).toBe(true);
  });

  it('does not create or invalidate any cache entry for an api spec of an uncached workspace', () => {
    const workspaceId = 'wrk_uncached';

    expect(() =>
      updateAppDataOnDbChanges(queryClient, [change('update', fakeApiSpec({ parentId: workspaceId }))]),
    ).not.toThrow();

    expect(queryClient.getQueryState(workspaceChildrenKeys.byWorkspaceId(workspaceId))).toBeUndefined();
  });

  it('ignores doc types it does not monitor', () => {
    const settings = fakeDoc('Settings', { _id: 'settings_1' });
    expect(() => updateAppDataOnDbChanges(queryClient, [change('update', settings)])).not.toThrow();
  });
});

describe('prefetchUncachedWorkspaceChildren', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity, retry: false } },
    });
    vi.mocked(services.appData.getWorkspaceChildren).mockReset();
  });

  it('fetches all workspace ids in a single batched call when none are cached', async () => {
    const childrenA = {
      data: { requestsAndGroups: [] },
      dataMetas: { allRequestMetas: [], requestGroupMetas: [] },
    };
    const childrenB = {
      data: { requestsAndGroups: [] },
      dataMetas: { allRequestMetas: [], requestGroupMetas: [] },
    };
    vi.mocked(services.appData.getWorkspaceChildren).mockResolvedValue(
      new Map([
        ['wrk_a', childrenA],
        ['wrk_b', childrenB],
      ]),
    );

    await prefetchUncachedWorkspaceChildren(queryClient, ['wrk_a', 'wrk_b'], 'collection');

    expect(services.appData.getWorkspaceChildren).toHaveBeenCalledTimes(1);
    expect(services.appData.getWorkspaceChildren).toHaveBeenCalledWith(['wrk_a', 'wrk_b'], 'collection');
    expect(queryClient.getQueryData(workspaceChildrenKeys.byWorkspaceId('wrk_a'))).toBe(childrenA);
    expect(queryClient.getQueryData(workspaceChildrenKeys.byWorkspaceId('wrk_b'))).toBe(childrenB);
  });

  it('only fetches the uncached subset of workspace ids', async () => {
    const cachedChildren = {
      data: { requestsAndGroups: [] },
      dataMetas: { allRequestMetas: [], requestGroupMetas: [] },
    };
    queryClient.setQueryData(workspaceChildrenKeys.byWorkspaceId('wrk_a'), cachedChildren);

    const fetchedChildren = {
      data: { requestsAndGroups: [] },
      dataMetas: { allRequestMetas: [], requestGroupMetas: [] },
    };
    vi.mocked(services.appData.getWorkspaceChildren).mockResolvedValue(new Map([['wrk_b', fetchedChildren]]));

    await prefetchUncachedWorkspaceChildren(queryClient, ['wrk_a', 'wrk_b'], 'collection');

    expect(services.appData.getWorkspaceChildren).toHaveBeenCalledTimes(1);
    expect(services.appData.getWorkspaceChildren).toHaveBeenCalledWith(['wrk_b'], 'collection');
  });

  it('does not call the service when every workspace id is already cached', async () => {
    queryClient.setQueryData(workspaceChildrenKeys.byWorkspaceId('wrk_a'), {
      data: { requestsAndGroups: [] },
      dataMetas: { allRequestMetas: [], requestGroupMetas: [] },
    });

    await prefetchUncachedWorkspaceChildren(queryClient, ['wrk_a'], 'collection');

    expect(services.appData.getWorkspaceChildren).not.toHaveBeenCalled();
  });
});
