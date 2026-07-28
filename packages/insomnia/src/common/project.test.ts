import { services, type Workspace } from 'insomnia-data';
import { beforeEach, describe, expect, it } from 'vitest';

import { database as db } from '~/common/database';

import { checkAllProjectSyncStatus, getUnsyncedRemoteWorkspaces, type InsomniaFile } from './project';

const mkRemoteFile = (id: string): InsomniaFile => ({
  id,
  name: `${id}-name`,
  scope: 'unsynced',
  label: 'Unsynced',
  created: 0,
  lastModifiedTimestamp: 0,
});

const mkWorkspace = (id: string): Workspace => ({ _id: id, scope: 'collection' }) as unknown as Workspace;

describe('getUnsyncedRemoteWorkspaces', () => {
  it('excludes a remote file once its workspace exists locally', () => {
    const remoteFiles = [mkRemoteFile('wrk_downloaded'), mkRemoteFile('wrk_pending')];
    const workspaces = [mkWorkspace('wrk_downloaded')];

    const result = getUnsyncedRemoteWorkspaces(remoteFiles, workspaces);

    expect(result.map(f => f.id)).toEqual(['wrk_pending']);
  });

  it('de-duplicates remote files sharing an id', () => {
    const remoteFiles = [mkRemoteFile('wrk_dup'), mkRemoteFile('wrk_dup')];

    const result = getUnsyncedRemoteWorkspaces(remoteFiles, []);

    expect(result.map(f => f.id)).toEqual(['wrk_dup']);
  });
});

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
