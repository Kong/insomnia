import { describe, expect, it } from 'vitest';

import { moveWorkspace } from './move-workspace.use-case';
import { buildWorkspace, createFakeWorkspaceRepository } from './testing/fake-workspace-repository';

describe('moveWorkspace', () => {
  it('moves an existing workspace to a different project', async () => {
    const workspace = buildWorkspace({ parentId: 'proj_1' });
    const repository = createFakeWorkspaceRepository([workspace]);

    const moved = await moveWorkspace(repository, workspace._id, 'proj_2');

    expect(moved.parentId).toBe('proj_2');
    expect((await repository.findById(workspace._id))?.parentId).toBe('proj_2');
  });

  it('throws when the workspace does not exist', async () => {
    const repository = createFakeWorkspaceRepository([]);

    await expect(moveWorkspace(repository, 'wrk_missing', 'proj_2')).rejects.toThrow('Workspace not found');
  });
});
