/**
 * @vitest-environment jsdom
 */
import { QueryClient, useMutation } from '@tanstack/react-query';
import React, { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const queryClient = new QueryClient();

vi.mock('insomnia-data', () => ({
  services: { userSession: { get: vi.fn() } },
}));
vi.mock('~/common/project', () => ({ syncProjects: vi.fn() }));
vi.mock('~/ui/organization-utils', () => ({
  findMigrationTargetSpaceId: vi.fn(() => 'org_target'),
  migrateProjectsUnderOrganization: vi.fn(),
}));
vi.mock('~/ui/context/app/server-data-context', () => ({ useServerDataQueryClient: () => queryClient }));
vi.mock('~/ui/hooks/use-query', () => ({
  useServerMutation: (options: Parameters<typeof useMutation>[0]) => useMutation(options, queryClient),
}));

import { services } from 'insomnia-data';

import { syncProjects } from '~/common/project';
import { migrateProjectsUnderOrganization } from '~/ui/organization-utils';

import { useStartupSync } from './use-startup-sync';

let root: Root;
let container: HTMLDivElement;
const result: { current: ReturnType<typeof useStartupSync> | null } = { current: null };

const Harness = ({ organizationId }: { organizationId: string }) => {
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

// TanStack Query delivers mutation results through its batched (setTimeout) notifier.
const flush = () => act(() => new Promise(resolve => setTimeout(resolve, 0)));

describe('useStartupSync', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(services.userSession.get).mockResolvedValue({ id: 'sess_1', accountId: 'acct_1' } as any);
    vi.mocked(syncProjects).mockResolvedValue();
    vi.mocked(migrateProjectsUnderOrganization).mockResolvedValue();
    window.localStorage.setItem('acct_1:spaces', JSON.stringify([{ id: 'org_1' }]));
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

  it('runs the migration and the project sync once per organization, despite the StrictMode double effect', async () => {
    await render('org_1');

    expect(migrateProjectsUnderOrganization).toHaveBeenCalledTimes(1);
    expect(migrateProjectsUnderOrganization).toHaveBeenCalledWith('org_target', 'sess_1');
    expect(syncProjects).toHaveBeenCalledTimes(1);
    expect(syncProjects).toHaveBeenCalledWith('org_1');
    expect(result.current?.status).toBe('idle');
  });

  it('syncs the projects only after the migration has finished', async () => {
    let finishMigration = () => {};
    vi.mocked(migrateProjectsUnderOrganization).mockReturnValue(
      new Promise<void>(resolve => {
        finishMigration = resolve;
      }),
    );

    await render('org_1');
    expect(migrateProjectsUnderOrganization).toHaveBeenCalledTimes(1);
    expect(syncProjects).not.toHaveBeenCalled();

    await act(async () => finishMigration());
    await flush();
    expect(syncProjects).toHaveBeenCalledWith('org_1');
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

    expect(migrateProjectsUnderOrganization).not.toHaveBeenCalled();
    expect(syncProjects).not.toHaveBeenCalled();
    expect(result.current?.status).toBe('idle');
  });

  it('reports an error without retrying by itself, and a retry runs the full task set again', async () => {
    vi.mocked(syncProjects).mockRejectedValueOnce(new Error('network'));

    await render('org_1');
    expect(result.current?.status).toBe('error');

    await render('org_1');
    expect(syncProjects).toHaveBeenCalledTimes(1);

    await act(async () => result.current?.retry());
    await flush();

    expect(migrateProjectsUnderOrganization).toHaveBeenCalledTimes(2);
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
});
