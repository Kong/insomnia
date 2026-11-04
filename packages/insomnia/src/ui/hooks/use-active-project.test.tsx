/**
 * @vitest-environment jsdom
 */
import { QueryClient, useQuery } from '@tanstack/react-query';
import type { OrganizationData } from 'insomnia-data';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
const params: { organizationId?: string; projectId?: string } = {};

vi.mock('react-router', () => ({ useParams: () => params }));
vi.mock('~/ui/hooks/use-query', () => ({
  useDBQuery: (options: Parameters<typeof useQuery>[0]) => useQuery(options, queryClient),
}));

import { organizationDataKeys } from '~/common/app-data';

import { useActiveProject } from './use-active-project';

const gitRepository = { _id: 'git_1', type: 'GitRepository' };
const organizationData = (projectName: string, workspaceMetaName: string) =>
  ({
    projects: [
      { _id: 'proj_1', name: projectName, parentId: 'org_1', gitRepository },
      { _id: 'proj_2', name: 'Other', parentId: 'org_1', gitRepository: undefined },
    ],
    workspaces: [],
    workspaceMetas: [{ _id: 'wrkm_1', parentId: 'wrk_1', name: workspaceMetaName }],
  }) as unknown as OrganizationData;

let root: Root;
let renders: number;
let result: ReturnType<typeof useActiveProject>;

const Harness = () => {
  renders++;
  result = useActiveProject();
  return null;
};

// TanStack Query notifies observers through its batched (setTimeout) notifier.
const flush = () => act(() => new Promise(resolve => setTimeout(resolve, 0)));
const render = async () => {
  await act(async () => root.render(<Harness />));
  await flush();
};
const setOrganizationData = async (data: OrganizationData) => {
  await act(async () => {
    queryClient.setQueryData(organizationDataKeys.byOrganizationId('org_1'), data);
  });
  await flush();
};

describe('useActiveProject', () => {
  beforeEach(() => {
    params.organizationId = 'org_1';
    params.projectId = 'proj_1';
    renders = 0;
    queryClient.setQueryData(organizationDataKeys.byOrganizationId('org_1'), organizationData('Project', 'a'));
    root = createRoot(document.createElement('div'));
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
  });

  it('returns the project without the joined git repository, and the repository separately', async () => {
    await render();

    expect(result?.activeProject).toEqual({ _id: 'proj_1', name: 'Project', parentId: 'org_1' });
    expect(result?.activeProject).not.toHaveProperty('gitRepository');
    expect(result?.activeProjectGitRepository).toBe(gitRepository);
  });

  it('does not re-render when organization data changes elsewhere', async () => {
    await render();
    const before = result;
    const rendersBefore = renders;

    await setOrganizationData(organizationData('Project', 'b'));

    expect(renders).toBe(rendersBefore);
    expect(result).toBe(before);
  });

  it('re-renders with the new project when the project changes', async () => {
    await render();

    await setOrganizationData(organizationData('Renamed', 'a'));

    expect(result?.activeProject?.name).toBe('Renamed');
  });

  it('has no project when it is not in the organization data', async () => {
    params.projectId = 'proj_missing';
    await render();

    expect(result).toEqual({ activeProject: undefined, activeProjectGitRepository: undefined });
  });

  it('returns undefined outside a project route', async () => {
    params.projectId = undefined;
    await render();

    expect(result).toBeUndefined();
  });
});
