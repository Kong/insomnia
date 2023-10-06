import * as crypto from 'crypto';

import { database as db } from '../common/database';
import { type BaseModel } from './index';

export const name = 'Environment';
export const type = 'Environment';
export const prefix = 'env';
export const canDuplicate = true;
export const canSync = true;

export interface BaseEnvironment {
  name: string;
  data: Record<string, any>;
  dataPropertyOrder: Record<string, any> | null;
  color: string | null;
  metaSortKey: number;
  // For sync control
  isPrivate: boolean;
}

export type Environment = BaseModel & BaseEnvironment;

export const isEnvironment = (model: Pick<BaseModel, 'type'>): model is Environment => (
  model.type === type
);

export function init() {
  return {
    name: 'New Environment',
    data: {},
    dataPropertyOrder: null,
    color: null,
    isPrivate: false,
    metaSortKey: Date.now(),
  };
}

export function migrate(doc: Environment) {
  return doc;
}

export function create(patch: Partial<Environment> = {}) {
  if (!patch.parentId) {
    throw new Error(`New Environment missing \`parentId\`: ${JSON.stringify(patch)}`);
  }

  return db.docCreate<Environment>(type, patch);
}

export function update(environment: Environment, patch: Partial<Environment>) {
  return db.docUpdate(environment, patch);
}

export function findByParentId(parentId: string) {
  return db.find<Environment>(
    type,
    {
      parentId,
    },
    {
      metaSortKey: 1,
    },
  );
}

export async function getOrCreateForParentId(parentId: string) {
  const environments = await db.find<Environment>(type, {
    parentId,
  });

  if (!environments.length) {
    // Deterministic base env ID. It helps reduce sync complexity since we won't have to
    // de-duplicate environments.
    const baseEnvironmentId = `${prefix}_${crypto.createHash('sha1').update(parentId).digest('hex')}`;
    try {
      const baseEnvironment = await create({
        parentId,
        name: 'Base Environment',
        _id: baseEnvironmentId,
      });

      return baseEnvironment;
    } catch (e) {
      const existingEnvironment = await getById(baseEnvironmentId);

      if (existingEnvironment) {
        return existingEnvironment;
      }

      throw e;
    }
  }

  return environments[environments.length - 1];
}

export function getById(id: string): Promise<Environment | null> {
  return db.get(type, id);
}

export function getByParentId(parentId: string): Promise<Environment | null> {
  return db.getWhere<Environment>(type, { parentId });
}

export async function duplicate(environment: Environment) {
  const name = `${environment.name} (Copy)`;
  // Get sort key of next environment
  const q = {
    metaSortKey: {
      $gt: environment.metaSortKey,
    },
  };
  // @ts-expect-error -- TSCONVERSION appears to be a genuine error
  const [nextEnvironment] = await db.find<Environment>(type, q, { metaSortKey: 1 });
  const nextSortKey = nextEnvironment ? nextEnvironment.metaSortKey : environment.metaSortKey + 100;
  // Calculate new sort key
  const metaSortKey = (environment.metaSortKey + nextSortKey) / 2;
  return db.duplicate(environment, {
    name,
    metaSortKey,
  });
}

export function remove(environment: Environment) {
  return db.remove(environment);
}

export function all() {
  return db.all<Environment>(type);
}
