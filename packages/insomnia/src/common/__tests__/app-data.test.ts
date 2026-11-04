import { QueryClient } from '@tanstack/react-query';
import type * as InsomniaData from 'insomnia-data';
import type { BaseModel, ChangeBufferEvent, CollectionWorkspaceChildren, OrganizationData } from 'insomnia-data';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { localFilesKeys, organizationDataKeys, untrackedProjectsKeys, workspaceChildrenKeys } from '~/common/app-data';

vi.mock('insomnia-data', async () => {
  const actual = await vi.importActual<typeof InsomniaData>('insomnia-data');
  return {
    ...actual,
    services: {
      appData: {
        getWorkspaceChildren: vi.fn(),
      },
      project: { list: vi.fn() },
      workspace: { list: vi.fn(), count: vi.fn() },
    },
  };
});

import { services } from 'insomnia-data';

import { prefetchUncachedWorkspaceChildren, untrackedProjectsQuery, updateAppDataOnDbChanges } from '../app-data';

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

  it('invalidates untracked projects on project and workspace changes, but not on workspace meta changes', () => {
    const key = untrackedProjectsKeys.byTrackedOrganizationIds(['org_1']);
    const isInvalidated = () => queryClient.getQueryState(key)?.isInvalidated;

    queryClient.setQueryData(key, { untrackedProjects: [], untrackedWorkspaces: [] });
    updateAppDataOnDbChanges(queryClient, [change('update', fakeDoc('WorkspaceMeta', { parentId: 'wrk_1' }))]);
    expect(isInvalidated()).toBe(false);

    updateAppDataOnDbChanges(queryClient, [change('insert', fakeDoc('Project', { parentId: 'org_gone' }))]);
    expect(isInvalidated()).toBe(true);

    queryClient.setQueryData(key, { untrackedProjects: [], untrackedWorkspaces: [] });
    updateAppDataOnDbChanges(queryClient, [change('remove', fakeDoc('Workspace', { parentId: 'proj_1' }))]);
    expect(isInvalidated()).toBe(true);
  });

  it.each<BaseModel['type']>(['Workspace', 'WorkspaceMeta', 'ApiSpec', 'MockServer', 'GitRepository'])(
    'invalidates every cached local files list when a %s changes',
    type => {
      const keys = [localFilesKeys.byProjectId('proj_1'), localFilesKeys.byProjectId('proj_2')];
      keys.forEach(key => queryClient.setQueryData(key, []));

      updateAppDataOnDbChanges(queryClient, [change('update', fakeDoc(type, { parentId: 'wrk_1' }))]);

      keys.forEach(key => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true));
    },
  );

  it('does not invalidate local files for doc types the project page does not read', () => {
    const key = localFilesKeys.byProjectId('proj_1');
    queryClient.setQueryData(key, []);

    updateAppDataOnDbChanges(queryClient, [
      change('update', fakeDoc('Project', { parentId: 'org_1' })),
      change('update', fakeDoc('Request', { parentId: 'wrk_1' })),
      change('update', fakeDoc('Environment', { parentId: 'wrk_1' })),
    ]);

    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false);
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

describe('untrackedProjectsQuery', () => {
  it('lists projects outside the tracked organizations with their workspace counts, plus orphaned workspaces', async () => {
    const orphanWorkspace = fakeDoc('Workspace', { _id: 'wrk_orphan', parentId: null as unknown as string });
    vi.mocked(services.project.list).mockResolvedValue([
      fakeDoc('Project', { _id: 'proj_a' }),
      fakeDoc('Project', { _id: 'proj_b' }),
    ] as any);
    vi.mocked(services.workspace.list).mockResolvedValue([orphanWorkspace] as any);
    vi.mocked(services.workspace.count).mockImplementation(async query =>
      (query as { parentId: string }).parentId === 'proj_a' ? 2 : 0,
    );

    const queryClient = new QueryClient();
    const result = await queryClient.fetchQuery(untrackedProjectsQuery(['org_1', 'org_2']));

    expect(services.project.list).toHaveBeenCalledWith({ parentId: { $nin: ['org_1', 'org_2'] } });
    expect(services.workspace.list).toHaveBeenCalledWith({ parentId: null });
    expect(result.untrackedProjects.map(p => [p._id, p.workspacesCount])).toEqual([
      ['proj_a', 2],
      ['proj_b', 0],
    ]);
    expect(result.untrackedWorkspaces).toEqual([orphanWorkspace]);
  });
});
