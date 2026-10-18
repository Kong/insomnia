import { services } from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import YAML from 'yaml';

import { database as db } from '~/common/database';

vi.mock('~/main/analytics', async () => {
  const { AnalyticsEvent } = await import('insomnia-analytics');
  return {
    AnalyticsEvent,
    trackAnalyticsEvent: vi.fn(),
    setCurrentOrganizationId: vi.fn(),
    trackPageView: vi.fn(),
  };
});

const { legacyWorkspaceIds } = vi.hoisted(() => ({ legacyWorkspaceIds: { value: [] as string[] } }));

// Pretend the remote repo contains one legacy `.insomnia/Workspace/<file>.yaml` per configured id.
vi.mock('~/sync/git/shallow-clone', () => ({
  shallowClone: vi.fn(async ({ fsClient }: { fsClient: any }) => {
    if (legacyWorkspaceIds.value.length === 0) {
      return;
    }
    await fsClient.promises.mkdir('.insomnia');
    await fsClient.promises.mkdir('.insomnia/Workspace');
    for (const [index, id] of legacyWorkspaceIds.value.entries()) {
      await fsClient.promises.writeFile(
        `.insomnia/Workspace/wrk_legacy_${index}.yaml`,
        YAML.stringify({ type: 'Workspace', _id: id, name: 'x', scope: 'collection' }),
      );
    }
  }),
}));

const { cloneGitRepoAction } = await import('~/main/git-service');

describe('cloneGitRepoAction change buffer', () => {
  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const spyOnBuffer = () => {
    const bufferSpy = vi.spyOn(db, 'bufferChanges');
    const flushSpy = vi.spyOn(db, 'flushChanges');
    return { bufferSpy, flushSpy };
  };

  const expectFlushedOnce = async ({ bufferSpy, flushSpy }: ReturnType<typeof spyOnBuffer>) => {
    expect(bufferSpy).toHaveBeenCalledTimes(1);
    const bufferId = await bufferSpy.mock.results[0].value;
    expect(flushSpy).toHaveBeenCalledTimes(1);
    expect(flushSpy).toHaveBeenCalledWith(bufferId);
  };

  it('flushes the change buffer when a legacy workspace with an unsafe _id is refused', async () => {
    legacyWorkspaceIds.value = ['wrk_../../../x'];
    const project = await services.project.create({ name: 'p', parentId: 'org_test' });
    const spies = spyOnBuffer();

    const result = await cloneGitRepoAction({
      organizationId: 'org_test',
      projectId: project._id,
      credentialsId: null,
      uri: 'https://example.com/repo.git',
    });

    expect(result.errors?.[0]).toMatch(/unsafe _id/);
    await expectFlushedOnce(spies);
  });

  it('flushes the change buffer when the repository contains multiple workspaces', async () => {
    legacyWorkspaceIds.value = ['wrk_one', 'wrk_two'];
    const project = await services.project.create({ name: 'p', parentId: 'org_test' });
    const spies = spyOnBuffer();

    const result = await cloneGitRepoAction({
      organizationId: 'org_test',
      projectId: project._id,
      credentialsId: null,
      uri: 'https://example.com/repo.git',
    });

    expect(result.errors?.[0]).toMatch(/Multiple workspaces/);
    await expectFlushedOnce(spies);
  });

  it('flushes the change buffer when a full clone into a missing project throws', async () => {
    legacyWorkspaceIds.value = [];
    const spies = spyOnBuffer();

    const result = await cloneGitRepoAction({
      organizationId: 'org_test',
      cloneIntoProjectId: 'proj_missing',
      credentialsId: null,
      uri: 'https://example.com/repo.git',
    });

    expect(result.errors?.[0]).toMatch(/Project not found/);
    await expectFlushedOnce(spies);
  });
});
