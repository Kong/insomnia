import { describe, expect, it } from 'vitest';

import { deleteWorkspace } from './delete-workspace.use-case';
import { buildWorkspace, createFakeWorkspaceRepository } from './testing/fake-workspace-repository';

describe('deleteWorkspace', () => {
  it('deletes an existing workspace', async () => {
    const workspace = buildWorkspace();
    const repository = createFakeWorkspaceRepository([workspace]);

    await deleteWorkspace(repository, workspace._id);

    expect(await repository.findById(workspace._id)).toBeNull();
  });

  it('throws when the workspace does not exist', async () => {
    const repository = createFakeWorkspaceRepository([]);

    await expect(deleteWorkspace(repository, 'wrk_missing')).rejects.toThrow('Workspace not found');
  });
});
