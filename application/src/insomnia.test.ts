import { describe, expect, it } from 'vitest';

import { buildEnvironment, createFakeEnvironmentRepository } from './environment/testing/fake-environment-repository';
import { Insomnia } from './insomnia';
import { buildRequest, createFakeRequestRepository } from './request/testing/fake-request-repository';
import { buildWorkspace, createFakeWorkspaceRepository } from './workspace/testing/fake-workspace-repository';

function buildDependencies(overrides: Partial<ConstructorParameters<typeof Insomnia>[0]> = {}) {
  return {
    workspaceRepository: createFakeWorkspaceRepository(),
    environmentRepository: createFakeEnvironmentRepository(),
    requestRepository: createFakeRequestRepository(),
    ...overrides,
  };
}

describe('Insomnia', () => {
  it('workspace.renameById() delegates to the injected WorkspaceRepository', async () => {
    const workspace = buildWorkspace();
    const workspaceRepository = createFakeWorkspaceRepository([workspace]);
    const insomnia = new Insomnia(buildDependencies({ workspaceRepository }));

    const renamed = await insomnia.workspace.renameById(workspace._id, 'Renamed');

    expect(renamed.name).toBe('Renamed');
    expect((await workspaceRepository.findById(workspace._id))?.name).toBe('Renamed');
  });

  it('environment.updateById() delegates to the injected EnvironmentRepository', async () => {
    const environment = buildEnvironment();
    const environmentRepository = createFakeEnvironmentRepository([environment]);
    const insomnia = new Insomnia(buildDependencies({ environmentRepository }));

    const updated = await insomnia.environment.updateById(environment._id, { name: 'Renamed' });

    expect(updated.name).toBe('Renamed');
    expect((await environmentRepository.findById(environment._id))?.name).toBe('Renamed');
  });

  it('request.deleteById() delegates to the injected RequestRepository', async () => {
    const request = buildRequest();
    const requestRepository = createFakeRequestRepository([request]);
    const insomnia = new Insomnia(buildDependencies({ requestRepository }));

    await insomnia.request.deleteById(request._id);

    expect(await requestRepository.findById(request._id)).toBeNull();
  });
});
