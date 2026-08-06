import { describe, expect, it } from 'vitest';

import { buildEnvironment, createFakeEnvironmentRepository } from './environment/testing/fake-environment-repository';
import { Insomnia } from './insomnia';
import { buildWorkspace, createFakeWorkspaceRepository } from './workspace/testing/fake-workspace-repository';

describe('Insomnia', () => {
  it('workspace.renameById() delegates to the injected WorkspaceRepository', async () => {
    const workspace = buildWorkspace();
    const workspaceRepository = createFakeWorkspaceRepository([workspace]);
    const insomnia = new Insomnia({ workspaceRepository, environmentRepository: createFakeEnvironmentRepository() });

    const renamed = await insomnia.workspace.renameById(workspace._id, 'Renamed');

    expect(renamed.name).toBe('Renamed');
    expect((await workspaceRepository.findById(workspace._id))?.name).toBe('Renamed');
  });

  it('environment.updateById() delegates to the injected EnvironmentRepository', async () => {
    const environment = buildEnvironment();
    const environmentRepository = createFakeEnvironmentRepository([environment]);
    const insomnia = new Insomnia({ workspaceRepository: createFakeWorkspaceRepository(), environmentRepository });

    const updated = await insomnia.environment.updateById(environment._id, { name: 'Renamed' });

    expect(updated.name).toBe('Renamed');
    expect((await environmentRepository.findById(environment._id))?.name).toBe('Renamed');
  });
});
