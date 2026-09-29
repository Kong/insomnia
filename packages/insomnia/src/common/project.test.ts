import { type Request, services, type UnitTest, type Workspace } from 'insomnia-data';
import { beforeEach, describe, expect, it } from 'vitest';

import { database as db } from '~/common/database';

import { checkAllProjectSyncStatus, getUnsyncedRemoteWorkspaces, type InsomniaFile, regenerateProjectDocIds } from './project';

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

describe('regenerateProjectDocIds', () => {
  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
  });

  it('re-keys the whole workspace tree while preserving content and relationships', async () => {
    const project = await services.project.create({
      _id: 'proj_git',
      name: 'Git',
      parentId: 'org_1',
      gitRepositoryId: 'gr_1',
    });
    const workspace = await services.workspace.create({
      _id: 'wrk_old',
      name: 'Collection',
      parentId: project._id,
      scope: 'collection',
    });
    const group = await services.requestGroup.create({ _id: 'grp_old', name: 'Folder', parentId: workspace._id });
    const request = await services.request.create({
      _id: 'req_old',
      name: 'Req',
      parentId: group._id,
      url: "https://example.com/{% request 'body', 'req_old', 'b64::JC51dWlk::46b', 'never', 60 %}",
    });
    const baseEnvironment = await services.environment.getOrCreateForParentId(workspace._id);
    const subEnvironment = await services.environment.create({
      _id: 'env_old',
      name: 'Sub',
      parentId: baseEnvironment._id,
    });
    const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(workspace._id);
    await services.workspaceMeta.update(workspaceMeta, {
      activeEnvironmentId: subEnvironment._id,
      activeRequestId: request._id,
    });

    await regenerateProjectDocIds(project);

    // Old ids are gone from the database.
    for (const doc of [workspace, group, request, subEnvironment]) {
      expect(await db.find(doc.type as never, { _id: doc._id })).toHaveLength(0);
    }

    // Exactly one workspace remains under the project, with a fresh id and the same content.
    const workspaces = await services.workspace.listByParentId(project._id);
    expect(workspaces).toHaveLength(1);
    const newWorkspace = workspaces[0];
    expect(newWorkspace._id).not.toBe('wrk_old');
    expect(newWorkspace.name).toBe('Collection');

    // Parent chains are remapped to the new ids.
    const newGroup = (await db.find('RequestGroup', { parentId: newWorkspace._id }))[0];
    expect(newGroup._id).not.toBe('grp_old');
    const newRequest = (await db.find('Request', { parentId: newGroup._id }))[0] as Request;
    expect(newRequest._id).not.toBe('req_old');
    expect(newRequest.url).not.toContain('req_old');

    // Per-doc UI state survives with remapped references.
    const newWorkspaceMeta = await services.workspaceMeta.getOrCreateByParentId(newWorkspace._id);
    expect(newWorkspaceMeta.activeRequestId).toBe(newRequest._id);
    expect(newWorkspaceMeta.activeEnvironmentId).not.toBe('env_old');
    expect(newWorkspaceMeta.activeEnvironmentId).not.toBeNull();

    // The project itself is untouched.
    expect((await services.project.getById(project._id))?._id).toBe(project._id);
  });

  it('leaves other projects untouched', async () => {
    const gitProject = await services.project.create({
      _id: 'proj_git',
      name: 'Git',
      parentId: 'org_1',
      gitRepositoryId: 'gr_1',
    });
    const otherProject = await services.project.create({
      _id: 'proj_other',
      name: 'Other',
      parentId: 'org_1',
      remoteId: 'remote_1',
    });
    const otherWorkspace = await services.workspace.create({
      _id: 'wrk_other',
      name: 'Other ws',
      parentId: otherProject._id,
      scope: 'collection',
    });

    await regenerateProjectDocIds(gitProject);

    expect((await services.workspace.getById(otherWorkspace._id))?._id).toBe('wrk_other');
  });

  it('re-keys runtime docs under requests and remaps cross-references', async () => {
    const project = await services.project.create({ _id: 'proj_git', name: 'Git', parentId: 'org_1', gitRepositoryId: 'gr_1' });
    const workspace = await services.workspace.create({
      _id: 'wrk_old',
      name: 'Collection',
      parentId: project._id,
      scope: 'collection',
    });
    await services.request.create({ _id: 'req_old', name: 'Req', parentId: workspace._id });
    await services.response.create({ _id: 'res_old', parentId: 'req_old' });
    const suite = await services.unitTestSuite.create({ _id: 'suite_old', name: 'Suite', parentId: workspace._id });
    await services.unitTest.create({ _id: 'test_old', name: 'Test', parentId: suite._id, requestId: 'req_old' });

    await regenerateProjectDocIds(project);

    const newWorkspace = (await services.workspace.listByParentId(project._id))[0];
    const newRequest = (await db.find('Request', { parentId: newWorkspace._id }))[0] as Request;
    const newSuite = (await db.find('UnitTestSuite', { parentId: newWorkspace._id }))[0];

    // The response hangs off the re-keyed request and got a fresh id itself.
    const newResponse = (await db.find('Response', { parentId: newRequest._id }))[0];
    expect(newResponse._id).not.toBe('res_old');
    expect(await db.find('Response', { _id: 'res_old' })).toHaveLength(0);

    // The unit test follows its re-keyed suite and request.
    const newTest = (await db.find<UnitTest>('UnitTest', { parentId: newSuite._id }))[0];
    expect(newTest._id).not.toBe('test_old');
    expect(newTest.requestId).toBe(newRequest._id);
    expect(await db.find('UnitTest', { _id: 'test_old' })).toHaveLength(0);
  });

  it('re-keys every workspace of the project independently', async () => {
    const project = await services.project.create({ _id: 'proj_git', name: 'Git', parentId: 'org_1', gitRepositoryId: 'gr_1' });
    const workspaceA = await services.workspace.create({
      _id: 'wrk_a',
      name: 'A',
      parentId: project._id,
      scope: 'collection',
    });
    const workspaceB = await services.workspace.create({
      _id: 'wrk_b',
      name: 'B',
      parentId: project._id,
      scope: 'collection',
    });
    await services.request.create({ _id: 'req_a', name: 'Req A', parentId: workspaceA._id });
    await services.request.create({ _id: 'req_b', name: 'Req B', parentId: workspaceB._id });

    await regenerateProjectDocIds(project);

    const workspaces = await services.workspace.listByParentId(project._id);
    expect(workspaces.map(w => w._id).sort()).not.toContain('wrk_a');
    expect(workspaces.map(w => w._id).sort()).not.toContain('wrk_b');
    expect(workspaces).toHaveLength(2);

    const requestIds = (await db.find('Request', {})).map(r => (r as Request)._id);
    expect(requestIds).toHaveLength(2);
    expect(requestIds).not.toContain('req_a');
    expect(requestIds).not.toContain('req_b');
    expect(new Set(requestIds).size).toBe(2);
  });

  it('handles an empty workspace without failing', async () => {
    const project = await services.project.create({ _id: 'proj_git', name: 'Git', parentId: 'org_1', gitRepositoryId: 'gr_1' });
    await services.workspace.create({
      _id: 'wrk_old',
      name: 'Empty',
      parentId: project._id,
      scope: 'collection',
    });

    await regenerateProjectDocIds(project);

    const workspaces = await services.workspace.listByParentId(project._id);
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0]._id).not.toBe('wrk_old');
    expect(workspaces[0].name).toBe('Empty');
  });
});
