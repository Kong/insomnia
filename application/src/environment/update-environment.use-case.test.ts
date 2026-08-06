import { describe, expect, it } from 'vitest';

import { buildEnvironment, createFakeEnvironmentRepository } from './testing/fake-environment-repository';
import { updateEnvironment } from './update-environment.use-case';

describe('updateEnvironment', () => {
  it('applies a partial patch to an existing environment', async () => {
    const environment = buildEnvironment({ name: 'Original', color: null });
    const repository = createFakeEnvironmentRepository([environment]);

    const updated = await updateEnvironment(repository, environment._id, { name: 'Renamed', color: '#fff' });

    expect(updated.name).toBe('Renamed');
    expect(updated.color).toBe('#fff');
    expect((await repository.findById(environment._id))?.name).toBe('Renamed');
  });

  it('throws when the environment does not exist', async () => {
    const repository = createFakeEnvironmentRepository([]);

    await expect(updateEnvironment(repository, 'env_missing', { name: 'Renamed' })).rejects.toThrow(
      'Environment not found',
    );
  });
});
