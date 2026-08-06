import { beforeEach, describe, expect, it } from 'vitest';

import type { Environment } from '../environment/environment.entity';
import type { EnvironmentRepository } from '../environment/environment-repository.port';

export interface EnvironmentRepositoryContractContext {
  repository: EnvironmentRepository;
  /** Seeds a fixture environment through whatever path the implementation under test provides. */
  createEnvironment: (patch?: Partial<Environment>) => Promise<Environment>;
  /** Resets storage to empty between tests. */
  reset: () => Promise<void>;
}

/**
 * Shared contract test suite for any EnvironmentRepository implementation - run this against
 * NedbEnvironmentRepository today, and against SqliteEnvironmentRepository once it exists, so
 * both stay behaviorally identical.
 */
export function runEnvironmentRepositoryContractTests(getContext: () => EnvironmentRepositoryContractContext) {
  describe('EnvironmentRepository contract', () => {
    beforeEach(async () => {
      await getContext().reset();
    });

    it('findById returns null for a missing id', async () => {
      const { repository } = getContext();

      expect(await repository.findById('env_does_not_exist')).toBeNull();
    });

    it('findById returns a previously saved environment', async () => {
      const { repository, createEnvironment } = getContext();
      const environment = await createEnvironment();

      expect(await repository.findById(environment._id)).toEqual(environment);
    });

    it('findByParentId returns only environments under that parent', async () => {
      const { repository, createEnvironment } = getContext();
      const parentId = 'wrk_contract_test';
      const a = await createEnvironment({ parentId, name: 'A' });
      const b = await createEnvironment({ parentId, name: 'B' });
      const other = await createEnvironment({ parentId: 'wrk_other', name: 'Other' });

      const found = await repository.findByParentId(parentId);

      expect(found.map(e => e._id).sort()).toEqual([a._id, b._id].sort());
      expect(found.some(e => e._id === other._id)).toBe(false);
    });

    it('save() persists changes to an existing environment', async () => {
      const { repository, createEnvironment } = getContext();
      const environment = await createEnvironment({ name: 'Original' });

      await repository.save({ ...environment, name: 'Renamed' });

      expect((await repository.findById(environment._id))?.name).toBe('Renamed');
    });

    it('delete() removes the environment', async () => {
      const { repository, createEnvironment } = getContext();
      const environment = await createEnvironment();

      await repository.delete(environment._id);

      expect(await repository.findById(environment._id)).toBeNull();
    });

    it('create() persists a new environment and returns it', async () => {
      const { repository } = getContext();

      const created = await repository.create({ parentId: 'wrk_contract_test', name: 'New Environment' });

      expect(created.name).toBe('New Environment');
      expect(created.parentId).toBe('wrk_contract_test');
      expect(await repository.findById(created._id)).toEqual(created);
    });
  });
}
