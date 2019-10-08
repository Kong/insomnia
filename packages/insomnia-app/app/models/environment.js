// @flow
import * as crypto from 'crypto';
import * as db from '../common/database';
import type { BaseModel } from './index';
import type { Workspace } from './workspace';

export const name = 'Environment';
export const type = 'Environment';
export const prefix = 'env';
export const canDuplicate = true;
export const canSync = true;

type BaseEnvironment = {
  name: string,
  data: Object,
  dataPropertyOrder: Object | null,
  color: string | null,
  metaSortKey: number,

  // For sync control
  isPrivate: boolean,
};

export type Environment = BaseModel & BaseEnvironment;

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

export function migrate(doc: Environment): Environment {
  return doc;
}

export function create(patch: Object = {}): Promise<Environment> {
  if (!patch.parentId) {
    throw new Error(`New Environment missing \`parentId\`: ${JSON.stringify(patch)}`);
  }

  return db.docCreate(type, patch);
}

export function update(environment: Environment, patch: Object): Promise<Environment> {
  return db.docUpdate(environment, patch);
}

export function findByParentId(parentId: string): Promise<Array<Environment>> {
  return db.find(type, { parentId }, { metaSortKey: 1 });
}

export async function getOrCreateForWorkspaceId(workspaceId: string): Promise<Environment> {
  const environments = await db.find(type, { parentId: workspaceId });

  if (!environments.length) {
    return create({
      parentId: workspaceId,
      name: 'Base Environment',

      // Deterministic base env ID. It helps reduce sync complexity since we won't have to
      // de-duplicate environments.
      _id: `${prefix}_${crypto
        .createHash('sha1')
        .update(workspaceId)
        .digest('hex')}`,
    });
  }

  return environments[environments.length - 1];
}

export async function getOrCreateForWorkspace(workspace: Workspace): Promise<Environment> {
  return getOrCreateForWorkspaceId(workspace._id);
}

export function getById(id: string): Promise<Environment | null> {
  return db.get(type, id);
}

export async function duplicate(environment: Environment): Promise<Environment> {
  const name = `${environment.name} (Copy)`;

  // Get sort key of next environment
  const q = { metaSortKey: { $gt: environment.metaSortKey } };
  const [nextEnvironment] = await db.find(type, q, { metaSortKey: 1 });
  const nextSortKey = nextEnvironment ? nextEnvironment.metaSortKey : environment.metaSortKey + 100;

  // Calculate new sort key
  const metaSortKey = (environment.metaSortKey + nextSortKey) / 2;

  return db.duplicate(environment, { name, metaSortKey });
}

export function remove(environment: Environment): Promise<void> {
  return db.remove(environment);
}

export function all(): Promise<Array<Environment>> {
  return db.all(type);
}
