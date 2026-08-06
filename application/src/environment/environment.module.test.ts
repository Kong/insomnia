import { describe, expect, it } from 'vitest';

import { EnvironmentModule } from './environment.module';
import { buildEnvironment, createFakeEnvironmentRepository } from './testing/fake-environment-repository';

describe('EnvironmentModule', () => {
  it('create() delegates to createEnvironment', async () => {
    const module = new EnvironmentModule(createFakeEnvironmentRepository());

    const created = await module.create({ parentId: 'wrk_1' });

    expect(created.parentId).toBe('wrk_1');
  });

  it('updateById() delegates to updateEnvironment', async () => {
    const environment = buildEnvironment({ name: 'Original' });
    const module = new EnvironmentModule(createFakeEnvironmentRepository([environment]));

    const updated = await module.updateById(environment._id, { name: 'Renamed' });

    expect(updated.name).toBe('Renamed');
  });

  it('deleteById() delegates to deleteEnvironment', async () => {
    const baseEnvironment = buildEnvironment({ _id: 'env_base', parentId: 'wrk_1' });
    const subEnvironment = buildEnvironment({ _id: 'env_sub', parentId: 'env_base' });
    const repository = createFakeEnvironmentRepository([baseEnvironment, subEnvironment]);
    const module = new EnvironmentModule(repository);

    await module.deleteById(subEnvironment._id, 'wrk_1');

    expect(await repository.findById(subEnvironment._id)).toBeNull();
  });
});
