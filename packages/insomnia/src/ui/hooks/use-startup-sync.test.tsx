/**
 * @vitest-environment jsdom
 */
import { QueryClient, useMutation, useQuery } from '@tanstack/react-query';
import React, { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const queryClient = new QueryClient();

vi.mock('insomnia-data', () => ({
  services: {
    userSession: { get: vi.fn() },
    project: { count: vi.fn(), create: vi.fn() },
    workspace: { create: vi.fn() },
  },
}));
vi.mock('~/common/project', () => ({ syncProjects: vi.fn() }));
vi.mock('~/ui/hooks/use-query', () => ({
  useServerMutation: (options: Parameters<typeof useMutation>[0]) => useMutation(options, queryClient),
  useServerQuery: (options: Parameters<typeof useQuery>[0]) => useQuery(options, queryClient),
}));

import { services } from 'insomnia-data';

import { syncProjects } from '~/common/project';

import { startupSyncQuery, useStartupSync } from './use-startup-sync';

let root: Root;
let container: HTMLDivElement;
const result: { current: ReturnType<typeof useStartupSync> | null } = { current: null };
const query: { current: { status: string; data: unknown } | null } = { current: null };

const Harness = ({ organizationId }: { organizationId: string }) => {
  // Read before the layout's own read, like the empty project view (a child, whose render and
  // effects come before the organization layout's).
  query.current = useQuery(startupSyncQuery(organizationId), queryClient);
  result.current = useStartupSync(organizationId);
  return null;
};

const render = async (organizationId: string) => {
  await act(async () => {
    root.render(
      <StrictMode>
        <Harness organizationId={organizationId} />
      </StrictMode>,
    );
  });
  await flush();
};

// TanStack Query delivers query results through its batched (setTimeout) notifier.
const flush = () => act(() => new Promise(resolve => setTimeout(resolve, 0)));

describe('useStartupSync', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(services.userSession.get).mockResolvedValue({ id: 'sess_1', accountId: 'acct_1' } as any);
    vi.mocked(syncProjects).mockResolvedValue();
    // Not the account's first landing, unless a test says otherwise.
    window.localStorage.setItem('firstAccountLandingHandled:acct_1', 'true');
    vi.mocked(services.project.count).mockResolvedValue(0);
    vi.mocked(services.project.create).mockResolvedValue({ _id: 'proj_drafts' } as any);
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('syncs the projects once per organization, despite the StrictMode double effect', async () => {
    await render('org_1');

    expect(syncProjects).toHaveBeenCalledTimes(1);
    expect(syncProjects).toHaveBeenCalledWith('org_1');
    expect(result.current?.status).toBe('idle');
  });

  it('syncs an organization entered later, but not one already synced in this session', async () => {
    await render('org_1');
    await render('org_2');
    act(() => root.unmount());
    root = createRoot(container);
    await render('org_1');

    expect(syncProjects).toHaveBeenCalledTimes(2);
    expect(syncProjects).toHaveBeenNthCalledWith(1, 'org_1');
    expect(syncProjects).toHaveBeenNthCalledWith(2, 'org_2');
  });

  it('does nothing when logged out', async () => {
    vi.mocked(services.userSession.get).mockResolvedValue({ id: '', accountId: '' } as any);

    await render('org_scratchpad');

    expect(syncProjects).not.toHaveBeenCalled();
    expect(result.current?.status).toBe('idle');
  });

  it('reports an error without retrying by itself, even on remount, and a retry syncs again', async () => {
    vi.mocked(syncProjects).mockRejectedValueOnce(new Error('network'));

    await render('org_1');
    expect(result.current?.status).toBe('error');

    await render('org_1');
    act(() => root.unmount());
    root = createRoot(container);
    await render('org_1');
    expect(syncProjects).toHaveBeenCalledTimes(1);
    expect(result.current?.status).toBe('error');

    await act(async () => result.current?.retry());
    await flush();

    expect(syncProjects).toHaveBeenCalledTimes(2);
    expect(syncProjects).toHaveBeenLastCalledWith('org_1');
    expect(result.current?.status).toBe('idle');
  });

  it('reports the status of the current organization only', async () => {
    vi.mocked(syncProjects).mockRejectedValueOnce(new Error('network'));

    await render('org_1');
    expect(result.current?.status).toBe('error');

    await render('org_2');
    expect(result.current?.status).toBe('idle');
  });

  it('is pending from the first render until the run settles', async () => {
    let finishSync = () => {};
    vi.mocked(syncProjects).mockReturnValue(
      new Promise<void>(resolve => {
        finishSync = resolve;
      }),
    );

    await act(async () => {
      root.render(<Harness organizationId="org_1" />);
    });
    expect(query.current?.status).toBe('pending');
    await flush();
    expect(query.current?.status).toBe('pending');

    await act(async () => finishSync());
    await flush();
    expect(query.current?.status).toBe('success');
  });

  describe('on the account\'s first landing', () => {
    beforeEach(() => {
      window.localStorage.clear();
    });

    it('creates the Drafts project after the sync when the organization is still empty', async () => {
      const order: string[] = [];
      vi.mocked(syncProjects).mockImplementation(async () => void order.push('sync'));
      vi.mocked(services.project.count).mockImplementation(async () => {
        order.push('count');
        return 0;
      });

      await render('org_1');

      expect(order).toEqual(['sync', 'count']);
      expect(services.project.count).toHaveBeenCalledWith({ parentId: 'org_1' });
      expect(services.project.create).toHaveBeenCalledWith({ name: 'Drafts', parentId: 'org_1' });
      expect(services.workspace.create).toHaveBeenCalledWith({
        name: 'My first collection',
        scope: 'collection',
        parentId: 'proj_drafts',
      });
      expect(query.current?.data).toEqual({ initialProjectId: 'proj_drafts' });
    });

    it('creates nothing when the sync brought projects in', async () => {
      vi.mocked(services.project.count).mockResolvedValue(2);

      await render('org_1');

      expect(services.project.create).not.toHaveBeenCalled();
      expect(query.current?.data).toEqual({ initialProjectId: undefined });
    });

    it('creates nothing when the sync failed', async () => {
      vi.mocked(syncProjects).mockRejectedValueOnce(new Error('network'));

      await render('org_1');

      expect(services.project.count).not.toHaveBeenCalled();
      expect(result.current?.status).toBe('error');
    });

    it('does not fail the sync when the creation fails', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(services.project.create).mockRejectedValueOnce(new Error('db'));

      await render('org_1');

      expect(result.current?.status).toBe('idle');
      expect(query.current?.data).toEqual({ initialProjectId: undefined });
    });
  });

  it('creates nothing once the account has landed before', async () => {
    await render('org_1');

    expect(services.project.count).not.toHaveBeenCalled();
    expect(services.project.create).not.toHaveBeenCalled();
  });
});
