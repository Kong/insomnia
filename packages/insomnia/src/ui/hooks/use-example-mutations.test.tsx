/**
 * @vitest-environment jsdom
 */
import { QueryClient } from '@tanstack/react-query';
import type { Request } from 'insomnia-data';
import { services } from 'insomnia-data';
import React, { type FC } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// React only allows act() for components when this host flag is set.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
  useDBQueryClient: () => testState.queryClient,
}));

import { isExampleDeletedInSession, useCreateExample, useDeleteExample, useUpdateExample } from './use-example-mutations';

// Minimal renderHook-style harness so this test doesn't need to pull in
// @testing-library/react's DOM utilities just to observe hook values.
function renderHook<T>(useHook: () => T) {
  const container = document.createElement('div');
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
    },
  };
}

const settle = async () => {
  for (let i = 0; i < 20; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('use-example-mutations', () => {
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
      metaSortKey: 0,
    })) as Request;

    organizationId = 'org_test';
    projectId = project._id;
    workspaceId = workspace._id;
    requestId = request._id;

    testState.queryClient = new QueryClient();
    testState.navigate.mockClear();
    testState.showError.mockClear();
    testState.params = { organizationId, projectId, workspaceId };
  });

  it('names the example after its status and navigates with the variables, not the route params', async () => {
    const hook = renderHook(useCreateExample);
    // The caller sits on a project-level route with another workspace in its params.
    testState.params = { organizationId: 'org_other', projectId: 'proj_other', workspaceId: undefined };

    act(() => {
      hook.result.mutate({ requestId, workspaceId, projectId, organizationId, response: { statusCode: 404 } });
    });
    await settle();

    const [created] = await services.example.listByParentIds(requestId);
    expect(created.name).toBe('404 Not Found');
    expect(testState.navigate).toHaveBeenCalledWith(
      `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}/example/${created._id}`,
    );
    hook.unmount();
  });

  it('marks a deleted example so the route redirects without warning', async () => {
    const example = await services.example.create({ parentId: requestId, name: '200 OK' });
    const hook = renderHook(useDeleteExample);

    act(() => {
      hook.result.mutate({ exampleId: example._id });
    });
    await settle();

    expect(await services.example.getById(example._id)).toBeUndefined();
    expect(isExampleDeletedInSession(example._id)).toBe(true);
    hook.unmount();
  });

  it('reports an invalid patch instead of writing it', async () => {
    const example = await services.example.create({ parentId: requestId, name: '200 OK' });
    const hook = renderHook(useUpdateExample);

    act(() => {
      hook.result.mutate({ exampleId: example._id, patch: { response: { statusCode: Number.NaN } } });
    });
    await settle();

    expect(testState.showError).toHaveBeenCalledTimes(1);
    expect((await services.example.getById(example._id))?.response.statusCode).toBe(200);
    hook.unmount();
  });
});
