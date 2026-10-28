import { services } from 'insomnia-data';
import { describe, expect, it } from 'vitest';

const createProjectWorkspace = async ({ remoteId, parentId }: { remoteId: string | null; parentId?: string }) => {
  const project = await services.project.create({ name: 'sync-flag-test', remoteId, parentId });
  const workspace = await services.workspace.create({ name: 'sync-flag-workspace', parentId: project._id });
  return { project, workspace };
};

describe('clearWorkspaceSyncFlags()', () => {
  it('clears dirty metas and keeps clean metas untouched', async () => {
    const { project, workspace } = await createProjectWorkspace({ remoteId: null });
    const workspaceMeta = await services.workspaceMeta.create({
      parentId: workspace._id,
      hasUncommittedChanges: true,
      hasUnpushedChanges: true,
    });

    const { workspace: otherWorkspace } = await createProjectWorkspace({ remoteId: null });
    await services.workspaceMeta.create({
      parentId: otherWorkspace._id,
      hasUncommittedChanges: true,
      hasUnpushedChanges: true,
    });

    await services.project.clearWorkspaceSyncFlags(project._id);

    expect(await services.workspaceMeta.getByParentId(workspace._id)).toEqual(
      expect.objectContaining({
        hasUncommittedChanges: false,
        hasUnpushedChanges: false,
        modified: workspaceMeta.modified,
      }),
    );
    expect(await services.workspaceMeta.getByParentId(otherWorkspace._id)).toEqual(
      expect.objectContaining({
        hasUncommittedChanges: true,
        hasUnpushedChanges: true,
      }),
    );
  });
});

describe('update()', () => {
  it('clears sync flags when a project stops being remote', async () => {
    const { project, workspace } = await createProjectWorkspace({ remoteId: 'proj_remote' });
    const workspaceMeta = await services.workspaceMeta.create({
      parentId: workspace._id,
      hasUncommittedChanges: true,
      hasUnpushedChanges: true,
    });

    await services.project.update(project, { remoteId: null });

    expect(await services.workspaceMeta.getByParentId(workspace._id)).toEqual(
      expect.objectContaining({
        hasUncommittedChanges: false,
        hasUnpushedChanges: false,
        modified: workspaceMeta.modified,
      }),
    );
  });

  it('keeps sync flags while the project stays remote', async () => {
    const { project, workspace } = await createProjectWorkspace({ remoteId: 'proj_remote' });
    await services.workspaceMeta.create({
      parentId: workspace._id,
      hasUncommittedChanges: true,
      hasUnpushedChanges: true,
    });

    await services.project.update(project, { name: 'renamed' });

    expect(await services.workspaceMeta.getByParentId(workspace._id)).toEqual(
      expect.objectContaining({
        hasUncommittedChanges: true,
        hasUnpushedChanges: true,
      }),
    );
  });
});

describe('syncTeamProjects()', () => {
  it('clears sync flags when a remote project is removed', async () => {
    const { project, workspace } = await createProjectWorkspace({
      remoteId: 'proj_remote',
      parentId: 'org_test',
    });
    const workspaceMeta = await services.workspaceMeta.create({
      parentId: workspace._id,
      hasUncommittedChanges: true,
      hasUnpushedChanges: true,
    });

    await services.project.syncTeamProjects({ organizationId: 'org_test', teamProjects: [] });

    expect(await services.project.getById(project._id)).toEqual(
      expect.objectContaining({
        remoteId: null,
      }),
    );
    expect(await services.workspaceMeta.getByParentId(workspace._id)).toEqual(
      expect.objectContaining({
        hasUncommittedChanges: false,
        hasUnpushedChanges: false,
        modified: workspaceMeta.modified,
      }),
    );
  });
});
