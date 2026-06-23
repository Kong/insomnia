import { services } from 'insomnia-data';
import { beforeEach, describe, expect, it } from 'vitest';

import { database as db } from '~/common/database';

import { checkAllProjectSyncStatus } from './project';

describe('checkAllProjectSyncStatus', () => {
  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
  });

  it('ignores stale sync flags on purely local projects, but reports them for git and cloud projects', async () => {
    // Local: no remote, no git. Git: has gitRepositoryId (remoteId is still null). Cloud: has remoteId.
    const local = await services.project.create({ _id: 'proj_local', name: 'Local', parentId: 'org_1' });
    const git = await services.project.create({
      _id: 'proj_git',
      name: 'Git',
      parentId: 'org_1',
      gitRepositoryId: 'gr_1',
    });
    const cloud = await services.project.create({
      _id: 'proj_cloud',
      name: 'Cloud',
      parentId: 'org_1',
      remoteId: 'proj_org_1',
    });

    // Every project has a workspace with stale uncommitted-changes flags persisted on its meta.
    for (const project of [local, git, cloud]) {
      const workspace = await services.workspace.create({
        name: `${project.name} ws`,
        parentId: project._id,
        scope: 'collection',
      });
      await services.workspaceMeta.create({ parentId: workspace._id, hasUncommittedChanges: true });
    }

    const status = await checkAllProjectSyncStatus([local, git, cloud]);

    expect(status).toEqual({
      proj_local: false,
      proj_git: true,
      proj_cloud: true,
    });
  });
});
