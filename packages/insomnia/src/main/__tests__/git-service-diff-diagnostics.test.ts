import { models, services } from 'insomnia-data';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { database as db } from '~/common/database';
import GitVCS from '~/sync/git/git-vcs';

// See git-service-repo-folder.test.ts for why main/analytics is replaced.
vi.mock('~/main/analytics', async () => {
  const { AnalyticsEvent } = await import('insomnia-analytics');
  return {
    AnalyticsEvent,
    trackAnalyticsEvent: vi.fn(),
    setCurrentOrganizationId: vi.fn(),
    trackPageView: vi.fn(),
  };
});

const reportModule = await import('~/common/insomnia-v5-change-report');
const buildReport = vi.spyOn(reportModule, 'buildInsomniaChangeReport');
const { diffFileLoader } = await import('~/main/git-service');

const yaml = `type: collection.insomnia.rest/5.0
name: My Collection
meta:
  id: wrk_6d1aa0becd154ea28352f43614d2c2f6
  created: 1
  modified: 1
collection: []
`;

describe('diffFileLoader diagnostics', () => {
  let projectId: string;

  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
    buildReport.mockClear();

    const repo = await services.gitRepository.create({ uri: 'https://example.com/foo.git', directory: '/tmp/repo' });
    const project = await services.project.create({
      name: 'Git project',
      gitRepositoryId: models.project.toProtectedRepoId(repo._id),
    });
    projectId = project._id;

    vi.spyOn(GitVCS, 'fileStatus').mockResolvedValue({
      head: yaml,
      stage: yaml,
      workdir: yaml,
      rawHead: yaml,
      rawStage: yaml,
      oids: { head: 'a', workdir: 'b', stage: 'c' },
    } as unknown as Awaited<ReturnType<typeof GitVCS.fileStatus>>);
  });

  it('skips the change analysis entirely while Debug Mode is off', async () => {
    const result = await diffFileLoader({ projectId, filepath: 'collection.yaml', staged: false });

    expect('errors' in result).toBe(false);
    expect('diagnostics' in result && result.diagnostics).toBeUndefined();
    expect(buildReport).not.toHaveBeenCalled();
  });

  it('returns the change analysis once Debug Mode is on', async () => {
    await services.settings.patch({ debugMode: true });

    const result = await diffFileLoader({ projectId, filepath: 'collection.yaml', staged: false });

    expect('diagnostics' in result && result.diagnostics?.report.verdict).toBe('identical');
    expect(buildReport).toHaveBeenCalledOnce();
  });
});
