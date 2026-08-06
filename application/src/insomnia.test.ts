import { describe, expect, it } from 'vitest';

import { Insomnia } from './insomnia';
import { buildWorkspace, createFakeWorkspaceRepository } from './workspace/testing/fake-workspace-repository';

describe('Insomnia', () => {
  it('workspace.renameById() delegates to the injected WorkspaceRepository', async () => {
    const workspace = buildWorkspace();
    const workspaceRepository = createFakeWorkspaceRepository([workspace]);
    const insomnia = new Insomnia({ workspaceRepository });

    const renamed = await insomnia.workspace.renameById(workspace._id, 'Renamed');

    expect(renamed.name).toBe('Renamed');
    expect((await workspaceRepository.findById(workspace._id))?.name).toBe('Renamed');
  });
});
