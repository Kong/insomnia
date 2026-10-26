import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { models, services } from 'insomnia-data';
import type * as IsomorphicGit from 'isomorphic-git';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { database as db } from '~/common/database';

// git-service.ts pulls in main/analytics.ts, which pulls in @sentry/electron
// and other Electron-main-process-only globals that aren't relevant to the
// folder-naming logic under test here (and don't play well with the
// project's lightweight `electron` test mock). Replace it with a no-op that
// keeps the real, dependency-free `AnalyticsEvent` enum intact.
vi.mock('~/main/analytics', async () => {
  const { AnalyticsEvent } = await import('insomnia-analytics');
  return {
    AnalyticsEvent,
    trackAnalyticsEvent: vi.fn(),
    setCurrentOrganizationId: vi.fn(),
    trackPageView: vi.fn(),
  };
});

// The global test mock stubs isomorphic-git's `clone` as a total no-op (fine
// for tests that never look inside the result), which leaves no `.git`
// metadata at all — later calls in the clone flow (setConfig, currentBranch)
// then throw trying to read nonexistent git internals. Redirect `clone` to a
// real (network-free) `git.init` against whatever fs/dir it's given instead,
// producing a minimal-but-valid empty repo good enough for the rest of the
// clone flow to run for real.
vi.mock('isomorphic-git', async importOriginal => {
  const actual = await importOriginal<typeof IsomorphicGit>();
  return {
    ...actual,
    clone: vi.fn(async ({ fs, dir, gitdir }: { fs: unknown; dir: string; gitdir: string }) => {
      await actual.init({ fs: fs as never, dir, gitdir, defaultBranch: 'main' });
    }),
    push: vi.fn(),
  };
});

const { cloneGitRepoAction } = await import('~/main/git-service');

const ORGANIZATION_ID = 'org_test';

describe('cloneGitRepoAction folder naming', () => {
  let tmpParent: string;

  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
    tmpParent = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-clone-'));
  });

  const getRepoForProject = async (projectId: string) => {
    const project = await services.project.getById(projectId);
    const repoId = models.project.decodeRepoId(project!.gitRepositoryId!);
    return services.gitRepository.getById(repoId);
  };

  // Regression: folderSlug used to only ever get set by the one-time startup
  // backfill, never at clone time — so every repo cloned into the default
  // (app-managed) location kept the unreadable `git_<hex>` folder name until
  // the next app restart.
  it('sets folderSlug from the project name when cloning into the managed (default) location', async () => {
    const result = await cloneGitRepoAction({
      organizationId: ORGANIZATION_ID,
      credentialsId: null,
      uri: 'https://example.com/my-repo.git',
      name: 'My Cool Project',
    });

    expect(result.errors).toBeUndefined();
    if (!result.projectId) {
      throw new Error('expected a successful clone result with a projectId');
    }
    const repo = await getRepoForProject(result.projectId);
    expect(repo?.directory).toBeNull();
    expect(repo?.folderSlug).toBe('my-cool-project');
  });

  it('leaves folderSlug null when cloning into a user-chosen directory (irrelevant there)', async () => {
    const target = path.join(tmpParent, 'my-repo');

    const result = await cloneGitRepoAction({
      organizationId: ORGANIZATION_ID,
      credentialsId: null,
      uri: 'https://example.com/my-repo.git',
      directory: target,
      name: 'My Project',
    });

    expect(result.errors).toBeUndefined();
    if (!result.projectId) {
      throw new Error('expected a successful clone result with a projectId');
    }
    const repo = await getRepoForProject(result.projectId);
    expect(repo?.directory).toBe(target);
    expect(repo?.folderSlug).toBeNull();
  });

  // Same fix, but the other code path: cloning a new workspace into an
  // EXISTING project (`projectId` provided) rather than creating a new one.
  it('sets folderSlug from the existing project\'s name when cloning a workspace into it', async () => {
    const project = await services.project.create({ name: 'Existing Project', parentId: ORGANIZATION_ID });

    const result = await cloneGitRepoAction({
      organizationId: ORGANIZATION_ID,
      projectId: project._id,
      credentialsId: null,
      uri: 'https://example.com/other-repo.git',
    });

    expect(result.errors).toBeUndefined();
    if (!result.workspaceId) {
      throw new Error('expected a successful clone result with a workspaceId');
    }
    const meta = await services.workspaceMeta.getByParentId(result.workspaceId);
    const repo = await services.gitRepository.getById(meta!.gitRepositoryId!);
    expect(repo?.directory).toBeNull();
    expect(repo?.folderSlug).toBe('existing-project');
  });
});
