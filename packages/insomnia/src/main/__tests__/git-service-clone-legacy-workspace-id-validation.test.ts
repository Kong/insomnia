import { services } from 'insomnia-data';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

const { legacyWorkspaceId } = vi.hoisted(() => ({ legacyWorkspaceId: { value: '' } }));

// Pretend the remote repo contains a legacy `.insomnia/Workspace/<file>.yaml` whose `_id` is attacker controlled.
vi.mock('~/sync/git/shallow-clone', () => ({
  shallowClone: vi.fn(async ({ fsClient }: { fsClient: any }) => {
    await fsClient.promises.mkdir('.insomnia');
    await fsClient.promises.mkdir('.insomnia/Workspace');
    await fsClient.promises.writeFile(
      '.insomnia/Workspace/wrk_legacy.yaml',
      YAML.stringify({ type: 'Workspace', _id: legacyWorkspaceId.value, name: 'x', scope: 'collection' }),
    );
  }),
}));

const { cloneGitRepoAction } = await import('~/main/git-service');

describe('cloneGitRepoAction legacy workspace id validation', () => {
  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
  });

  it('refuses a legacy workspace with an unsafe _id before creating any metadata for it', async () => {
    legacyWorkspaceId.value = 'wrk_../../../x';
    const project = await services.project.create({ name: 'p', parentId: 'org_test' });

    const result = await cloneGitRepoAction({
      organizationId: 'org_test',
      projectId: project._id,
      credentialsId: null,
      uri: 'https://example.com/repo.git',
    });

    expect(await services.workspaceMeta.getByParentId('wrk_../../../x')).toBeFalsy();
    expect(result.errors?.[0]).toMatch(/unsafe _id/);
  });
});
