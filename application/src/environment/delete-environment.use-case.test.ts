import { describe, expect, it } from 'vitest';

import { deleteEnvironment } from './delete-environment.use-case';
import { buildEnvironment, createFakeEnvironmentRepository } from './testing/fake-environment-repository';

describe('deleteEnvironment', () => {
  it('deletes a sub-environment', async () => {
    const baseEnvironment = buildEnvironment({ _id: 'env_base', parentId: 'wrk_1' });
    const subEnvironment = buildEnvironment({ _id: 'env_sub', parentId: 'env_base' });
    const repository = createFakeEnvironmentRepository([baseEnvironment, subEnvironment]);

    await deleteEnvironment(repository, subEnvironment._id, 'wrk_1');

    expect(await repository.findById(subEnvironment._id)).toBeNull();
  });

  it('throws when deleting the base environment', async () => {
    const baseEnvironment = buildEnvironment({ _id: 'env_base', parentId: 'wrk_1' });
    const repository = createFakeEnvironmentRepository([baseEnvironment]);

    await expect(deleteEnvironment(repository, baseEnvironment._id, 'wrk_1')).rejects.toThrow(
      'Cannot delete base environment',
    );
  });

  it('throws when the environment does not exist', async () => {
    const repository = createFakeEnvironmentRepository([]);

    await expect(deleteEnvironment(repository, 'env_missing', 'wrk_1')).rejects.toThrow('Environment not found');
  });
});
