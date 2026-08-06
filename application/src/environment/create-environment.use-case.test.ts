import { describe, expect, it } from 'vitest';

import { createEnvironment } from './create-environment.use-case';
import { createFakeEnvironmentRepository } from './testing/fake-environment-repository';

describe('createEnvironment', () => {
  it('creates a new environment through the repository', async () => {
    const repository = createFakeEnvironmentRepository();

    const created = await createEnvironment(repository, { parentId: 'wrk_1', isPrivate: true });

    expect(created.parentId).toBe('wrk_1');
    expect(await repository.findById(created._id)).toEqual(created);
  });
});
