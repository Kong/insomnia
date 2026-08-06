import type { Environment as DataEnvironment } from 'insomnia-data';
import { database, services } from 'insomnia-data';
import type { Environment, EnvironmentRepository, EnvironmentType } from 'insomnia-domain';

const toDomainEnvironment = (doc: DataEnvironment): Environment => ({
  _id: doc._id,
  type: 'Environment',
  parentId: doc.parentId,
  created: doc.created,
  modified: doc.modified,
  isPrivate: doc.isPrivate,
  name: doc.name,
  data: doc.data,
  dataPropertyOrder: doc.dataPropertyOrder,
  kvPairData: doc.kvPairData as unknown as Environment['kvPairData'],
  color: doc.color,
  metaSortKey: doc.metaSortKey,
  environmentType: doc.environmentType as unknown as EnvironmentType | undefined,
});

// Thin adapter over insomnia-data's existing services.environment/database calls - no
// reimplementation. save() uses the same raw database.update() call
// services.workspace.upsert() uses, rather than docUpdate()'s migration side effects, since a
// domain entity reaching this port is expected to already be fully-formed.
export const nedbEnvironmentRepository: EnvironmentRepository = {
  async findById(id) {
    const doc = await services.environment.getById(id);
    return doc ? toDomainEnvironment(doc) : null;
  },

  async findByParentId(parentId) {
    const docs = await services.environment.listByParentId(parentId);
    return docs.map(toDomainEnvironment);
  },

  async create(input) {
    const doc = await services.environment.create(input as unknown as Partial<DataEnvironment>);
    return toDomainEnvironment(doc);
  },

  async save(environment) {
    await database.update(environment as unknown as DataEnvironment);
  },

  async delete(id) {
    const doc = await services.environment.getById(id);
    if (doc) {
      await services.environment.remove(doc);
    }
  },
};
