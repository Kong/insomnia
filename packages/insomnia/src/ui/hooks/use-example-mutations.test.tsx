/**
 * @vitest-environment jsdom
 */
import { QueryClient } from '@tanstack/react-query';
import type { Example, ExampleSummary, Request, WorkspaceChildren } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import React, { type FC } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const testState = vi.hoisted(() => ({
  navigate: vi.fn(),
  showError: vi.fn(),
  params: {} as Record<string, string | undefined>,
  queryClient: null as QueryClient | null,
}));

vi.mock('react-router', () => ({
  // Interpolate the same way react-router's href does for plain path params.
  href: (pattern: string, params: Record<string, string>) =>
    pattern.replace(/:([A-Za-z]+)/g, (_, key: string) => params[key]),
  useNavigate: () => testState.navigate,
  useParams: () => testState.params,
}));

vi.mock('~/ui/components/modals', () => ({
  showError: testState.showError,
}));

vi.mock('~/ui/context/app/insomnia-app-data-context', () => ({
  useDBQueryClient: () => {
    if (!testState.queryClient) {
      throw new Error('test queryClient not set');
    }
    return testState.queryClient;
  },
}));

import { workspaceChildrenKeys } from '~/common/app-data';

import {
  isExampleDeletedInSession,
  useCreateExample,
  useDeleteExample,
  useUpdateExample,
} from './use-example-mutations';

// Minimal renderHook-style harness so this test doesn't need to pull in
// @testing-library/react's DOM utilities just to observe hook values.
function renderHook<T>(useHook: () => T) {
  let container: HTMLDivElement | null = document.createElement('div');
  let root: Root | null = createRoot(container);
  const resultRef: { current: T | null } = { current: null };

  const Consumer: FC = () => {
    resultRef.current = useHook();
    return null;
  };

  act(() => {
    root!.render(<Consumer />);
  });

  return {
    get result() {
      return resultRef.current as T;
    },
    unmount() {
      act(() => {
        root?.unmount();
      });
      root = null;
      container = null;
    },
  };
}

const collectionChildren = (requestsAndGroups: object[], examples: ExampleSummary[]) =>
  ({
    data: { requestsAndGroups, examples },
    dataMetas: { allRequestMetas: [], requestGroupMetas: [] },
  }) as WorkspaceChildren;

const setChildrenCache = (queryClient: QueryClient, workspaceId: string, children: WorkspaceChildren) =>
  queryClient.setQueryData(workspaceChildrenKeys.byWorkspaceId(workspaceId), children);

const getExamples = (queryClient: QueryClient, workspaceId: string): ExampleSummary[] => {
  const data = queryClient.getQueryData<WorkspaceChildren>(workspaceChildrenKeys.byWorkspaceId(workspaceId));
  return data && 'examples' in data.data ? data.data.examples : [];
};

const settle = async () => {
  for (let i = 0; i < 50; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('use-example-mutations', () => {
  let queryClient: QueryClient;
  let organizationId: string;
  let projectId: string;
  let workspaceId: string;
  let requestId: string;

  beforeEach(async () => {
    await services.settings.getOrCreate();

    const project = await services.project.create({ name: 'Test Project' });
    const workspace = await services.workspace.create({
      name: 'Test Workspace',
      parentId: project._id,
      scope: 'collection',
    });
    const request = (await services.request.create({
      name: 'Test Request',
      parentId: workspace._id,
      url: 'https://api.example.com/test',
      method: 'GET',
      metaSortKey: -1 * Date.now(),
    })) as Request;

    organizationId = 'org_test';
    projectId = project._id;
    workspaceId = workspace._id;
    requestId = request._id;

    queryClient = new QueryClient();
    testState.queryClient = queryClient;
    testState.navigate.mockClear();
    testState.showError.mockClear();
    testState.params = { organizationId, projectId, workspaceId };
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('useCreateExample', () => {
    it('navigates with the target ids from the mutation variables, not the calling route params', async () => {
      const hook = renderHook(useCreateExample);
      // The caller sits on a project-level route with a different workspace
      // in its params: navigation must still land on the created example.
      testState.params = { organizationId: 'org_other', projectId: 'proj_other', workspaceId: undefined };
      setChildrenCache(queryClient, workspaceId, collectionChildren([{ _id: requestId }], []));

      act(() => {
        hook.result.mutate({
          requestId,
          workspaceId,
          projectId,
          organizationId,
        });
      });
      await settle();

      const createdId = getExamples(queryClient, workspaceId)[0]?._id;
      expect(createdId).toBeDefined();
      expect(testState.navigate).toHaveBeenCalledTimes(1);
      expect(testState.navigate).toHaveBeenCalledWith(
        `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}/example/${createdId}`,
      );
      hook.unmount();
    });

    it('inserts the created example only into the workspace owning the parent request', async () => {
      const otherWorkspace = await services.workspace.create({
        name: 'Other Workspace',
        parentId: projectId,
        scope: 'collection',
      });
      const otherRequest = (await services.request.create({
        name: 'Other Request',
        parentId: otherWorkspace._id,
        url: 'https://other.example.com',
        method: 'GET',
        metaSortKey: -1 * Date.now(),
      })) as Request;

      setChildrenCache(queryClient, workspaceId, collectionChildren([{ _id: requestId }], []));
      setChildrenCache(queryClient, otherWorkspace._id, collectionChildren([{ _id: otherRequest._id }], []));

      const hook = renderHook(useCreateExample);
      act(() => {
        hook.result.mutate({ requestId, workspaceId, projectId, organizationId });
      });
      await settle();

      expect(getExamples(queryClient, workspaceId)).toHaveLength(1);
      expect(getExamples(queryClient, otherWorkspace._id)).toHaveLength(0);
      hook.unmount();
    });
  });

  describe('useUpdateExample', () => {
    it('rolls back only the examples arrays and preserves sibling fields changed during the window', async () => {
      const example = (await services.example.create({
        parentId: requestId,
        name: '200 OK',
        metaSortKey: -100,
      })) as Example;

      const requestsAndGroups = [{ _id: requestId }];
      setChildrenCache(
        queryClient,
        workspaceId,
        collectionChildren(requestsAndGroups, [models.example.toExampleSummary(example)]),
      );

      const hook = renderHook(useUpdateExample);
      // The write fails: the patch is validated against the wrong parent.
      const failingPatch = { name: 'Renamed' };
      act(() => {
        hook.result.mutate({
          exampleId: example._id,
          parentId: 'req_other',
          patch: failingPatch,
        });
      });
      // While the write is in flight, a DB change event patches a sibling
      // field into the same cache entry.
      queryClient.setQueryData<WorkspaceChildren>(workspaceChildrenKeys.byWorkspaceId(workspaceId), previous =>
        previous && 'requestsAndGroups' in previous.data
          ? ({ ...previous, data: { ...previous.data, requestsAndGroups: [{ _id: requestId }, { _id: 'req_new' }] } } as WorkspaceChildren)
          : previous,
      );
      await settle();

      expect(testState.showError).toHaveBeenCalledTimes(1);
      const data = queryClient.getQueryData<WorkspaceChildren>(workspaceChildrenKeys.byWorkspaceId(workspaceId))!;
      expect('examples' in data.data && data.data.examples).toEqual([models.example.toExampleSummary(example)]);
      expect('requestsAndGroups' in data.data && data.data.requestsAndGroups).toEqual([
        { _id: requestId },
        { _id: 'req_new' },
      ]);
      hook.unmount();
    });
  });

  describe('useDeleteExample', () => {
    it('removes the example from the cache after the delete is confirmed', async () => {
      const example = (await services.example.create({
        parentId: requestId,
        name: '200 OK',
        metaSortKey: -100,
      })) as Example;
      setChildrenCache(
        queryClient,
        workspaceId,
        collectionChildren([{ _id: requestId }], [models.example.toExampleSummary(example)]),
      );

      const hook = renderHook(useDeleteExample);
      act(() => {
        hook.result.mutate({ exampleId: example._id, parentId: example.parentId });
      });

      await settle();
      expect(await services.example.getById(example._id)).toBeUndefined();
      expect(getExamples(queryClient, workspaceId)).toHaveLength(0);
      expect(testState.navigate).not.toHaveBeenCalled();
      hook.unmount();
    });

    it('leaves the cache untouched when the delete fails', async () => {
      const example = (await services.example.create({
        parentId: requestId,
        name: '200 OK',
        metaSortKey: -100,
      })) as Example;
      setChildrenCache(
        queryClient,
        workspaceId,
        collectionChildren([{ _id: requestId }], [models.example.toExampleSummary(example)]),
      );

      const hook = renderHook(useDeleteExample);
      // Stale reference: the example no longer lives under the expected parent.
      act(() => {
        hook.result.mutate({ exampleId: example._id, parentId: 'req_other' });
      });
      await settle();

      expect(testState.showError).toHaveBeenCalledTimes(1);
      expect(getExamples(queryClient, workspaceId)).toHaveLength(1);
      expect(testState.navigate).not.toHaveBeenCalled();
      hook.unmount();
    });

    it('records the deleted id so the route can tell a user delete from a stale URL', async () => {
      const example = (await services.example.create({
        parentId: requestId,
        name: '200 OK',
        metaSortKey: -100,
      })) as Example;
      setChildrenCache(
        queryClient,
        workspaceId,
        collectionChildren([{ _id: requestId }], [models.example.toExampleSummary(example)]),
      );

      const hook = renderHook(useDeleteExample);
      act(() => {
        hook.result.mutate({ exampleId: example._id, parentId: example.parentId });
      });
      await settle();

      expect(isExampleDeletedInSession(example._id)).toBe(true);
      // Navigation belongs to the tab/route layers, not to the data mutation.
      expect(testState.navigate).not.toHaveBeenCalled();
      hook.unmount();
    });
  });
});
