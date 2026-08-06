import { describe, expect, it } from 'vitest';

import { buildWorkspace, createFakeWorkspaceRepository } from './testing/fake-workspace-repository';
import { WorkspaceModule } from './workspace.module';

describe('WorkspaceModule', () => {
  it('create() delegates to createWorkspace', async () => {
    const module = new WorkspaceModule(createFakeWorkspaceRepository());

    const created = await module.create({ name: 'New Workspace', scope: 'collection', parentId: 'proj_1' });

    expect(created.name).toBe('New Workspace');
  });

  it('moveById() delegates to moveWorkspace', async () => {
    const workspace = buildWorkspace({ parentId: 'proj_1' });
    const module = new WorkspaceModule(createFakeWorkspaceRepository([workspace]));

    const moved = await module.moveById(workspace._id, 'proj_2');

    expect(moved.parentId).toBe('proj_2');
  });

  it('deleteById() delegates to deleteWorkspace', async () => {
    const workspace = buildWorkspace();
    const repository = createFakeWorkspaceRepository([workspace]);
    const module = new WorkspaceModule(repository);

    await module.deleteById(workspace._id);

    expect(await repository.findById(workspace._id)).toBeNull();
  });
});
