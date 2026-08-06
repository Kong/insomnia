import { describe, expect, it } from 'vitest';

import { renameWorkspace } from './rename-workspace.use-case';
import { buildWorkspace, createFakeWorkspaceRepository } from './testing/fake-workspace-repository';

describe('renameWorkspace', () => {
  it('renames an existing workspace', async () => {
    const workspace = buildWorkspace();
    const repository = createFakeWorkspaceRepository([workspace]);

    const renamed = await renameWorkspace(repository, workspace._id, 'Renamed');

    expect(renamed.name).toBe('Renamed');
    expect((await repository.findById(workspace._id))?.name).toBe('Renamed');
  });

  it('throws when the workspace does not exist', async () => {
    const repository = createFakeWorkspaceRepository([]);

    await expect(renameWorkspace(repository, 'wrk_missing', 'Renamed')).rejects.toThrow('Workspace not found');
  });
});
