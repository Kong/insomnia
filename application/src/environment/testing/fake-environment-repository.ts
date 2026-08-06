import type { Environment, EnvironmentRepository } from 'insomnia-domain';

let nextId = 1;

export function createFakeEnvironmentRepository(seed: Environment[] = []): EnvironmentRepository {
  const store = new Map(seed.map(e => [e._id, e]));
  return {
    async findById(id) {
      return store.get(id) ?? null;
    },
    async findByParentId(parentId) {
      return [...store.values()].filter(e => e.parentId === parentId);
    },
    async create(input) {
      const environment = buildEnvironment({ _id: `env_${nextId++}`, ...input });
      store.set(environment._id, environment);
      return environment;
    },
    async save(environment) {
      store.set(environment._id, environment);
    },
    async delete(id) {
      store.delete(id);
    },
  };
}

export const buildEnvironment = (overrides: Partial<Environment> = {}): Environment => ({
  _id: 'env_1',
  type: 'Environment',
  parentId: 'wrk_1',
  created: 0,
  modified: 0,
  isPrivate: false,
  name: 'Original',
  data: {},
  color: null,
  metaSortKey: 0,
  ...overrides,
});
