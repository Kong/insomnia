// Base data service factory for all models. Provides common CRUD operations and abstracts away the underlying database implementation.
import { type AllTypes, type BaseServices, database, type ModelMap } from '~/insomnia-data';

export function createBaseOperations<U extends AllTypes>(modelType: U): BaseServices<U> {
  type T = ModelMap[U];

  return {
    async create(patch: Partial<T>): Promise<T> {
      return await database.docCreate<T>(modelType, patch);
    },
    async getById(id: string): Promise<T | undefined> {
      return await database.findOne<T>(modelType, { _id: id });
    },
    async getByParentId(parentId: string): Promise<T | undefined> {
      return await database.findOne<T>(modelType, { parentId });
    },
    async update(doc: T, patch: Partial<T>): Promise<T> {
      return await database.docUpdate<T>(doc, patch);
    },
    async remove(doc: T): Promise<void> {
      await database.remove(doc);
    },
    async removeWhere(parentId: string): Promise<void> {
      await database.removeWhere(modelType, { parentId });
    },
    async all(): Promise<T[]> {
      return await database.find<T>(modelType);
    },
  };
}
