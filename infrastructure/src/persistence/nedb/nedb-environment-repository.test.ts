import { database, services } from 'insomnia-data';
import { runEnvironmentRepositoryContractTests } from 'insomnia-domain/testing';

import { nedbEnvironmentRepository } from './nedb-environment-repository';

runEnvironmentRepositoryContractTests(() => ({
  repository: nedbEnvironmentRepository,
  async createEnvironment(patch) {
    const doc = await services.environment.create({ parentId: 'wrk_contract_test', ...patch });
    const environment = await nedbEnvironmentRepository.findById(doc._id);
    if (!environment) {
      throw new Error(`Failed to seed fixture environment ${doc._id}`);
    }
    return environment;
  },
  async reset() {
    await database.init({ inMemoryOnly: true }, true);
  },
}));
