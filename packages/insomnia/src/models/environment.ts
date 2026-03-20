import * as crypto from 'node:crypto';

import { database as db } from '../common/database';
import type { Project } from './project';
import * as project from './project';
import { type BaseModel } from './types';
import type { Workspace } from './workspace';
import * as workspace from './workspace';

export const name = 'Environment';
export const type = 'Environment';
export const prefix = 'env';
export const prefixEnvPair = 'envPair';
// vault environment path when saved in environment data
export const vaultEnvironmentPath = '__insomnia_vault';
// vault environment path when used in runtime rendering
export const vaultEnvironmentRuntimePath = 'vault';
export const vaultEnvironmentMaskValue = '••••••';
export const canDuplicate = true;
export const canSync = true;
// for those keys do not need to add in model init method
export const optionalKeys = ['kvPairData', 'environmentType'];

export interface BaseEnvironment {
  name: string;
  data: Record<string, any>;
  dataPropertyOrder: Record<string, any> | null;
  kvPairData?: EnvironmentKvPairData[];
  color: string | null;
  metaSortKey: number;
  // For sync control
  isPrivate: boolean;
  environmentType?: EnvironmentType;
}

export enum EnvironmentType {
  JSON = 'json',
  KVPAIR = 'kv',
}
export enum EnvironmentKvPairDataType {
  JSON = 'json',
  STRING = 'str',
  SECRET = 'secret',
}
export interface EnvironmentKvPairData {
  id: string;
  name: string;
  value: string;
  type: EnvironmentKvPairDataType;
  enabled?: boolean;
}
export type Environment = BaseModel & BaseEnvironment;
// This is a representation of the data taken from a csv or json file AKA iterationData
export type UserUploadEnvironment = Pick<Environment, 'data' | 'dataPropertyOrder' | 'name'>;

// remove all secret items when user reset vault key
export const removeAllSecrets = async (organizationIds: string[]) => {
  const allProjects = await db.find<Project>(project.type, {
    parentId: { $in: organizationIds },
  });
  const allProjectIds = allProjects.map(project => project._id);
  const allGlobalEnvironmentWorkspaces = await db.find<Workspace>(workspace.type, {
    parentId: { $in: allProjectIds },
    scope: workspace.WorkspaceScopeKeys.environment,
  });
  const allGlobalBaseEnvironments = await db.find<Environment>(type, {
    parentId: {
      $in: allGlobalEnvironmentWorkspaces.map(w => w._id),
    },
  });
  const allGlobalSubEnvironments = await db.find<Environment>(type, {
    parentId: {
      $in: allGlobalBaseEnvironments.map(e => e._id),
    },
  });
  const allGlobalEnvironments = allGlobalBaseEnvironments.concat(allGlobalSubEnvironments);
  const allGlobalPrivateEnvironments = allGlobalEnvironments.filter(env => env.isPrivate);
  allGlobalPrivateEnvironments.forEach(async privateEnv => {
    const { kvPairData, data } = privateEnv;
    if (vaultEnvironmentPath in data) {
      const { [vaultEnvironmentPath]: secretData, ...restData } = data;
      const filteredKvPairData = kvPairData?.filter(kvPair => kvPair.type !== EnvironmentKvPairDataType.SECRET);
      await update(privateEnv, { data: restData, kvPairData: filteredKvPairData });
    }
  });
};

export const isEnvironment = (model: Pick<BaseModel, 'type'>): model is Environment => model.type === type;

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
        // set default environment type to key-value type
        environmentType: EnvironmentType.KVPAIR,
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

export function getById(id: string): Promise<Environment | undefined> {
  return db.findOne<Environment>(type, { _id: id });
}

export function getByParentId(parentId: string): Promise<Environment | undefined> {
  return db.findOne<Environment>(type, { parentId });
}

export async function duplicate(environment: Environment) {
  const name = `${environment.name} (Copy)`;
  // Get sort key of next environment
  const q = {
    metaSortKey: {
      $gt: environment.metaSortKey,
    },
  };
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
  return db.find<Environment>(type);
}
