import * as crypto from 'crypto';
import orderedJSON from 'json-order';

import * as crypt from '../account/crypt';
import { JSON_ORDER_SEPARATOR } from '../common/constants';
import { database as db } from '../common/database';
import { generateId } from '../common/misc';
import { base64decode, base64encode } from '../utils/vault';
import { type BaseModel, project, workspace } from './index';
import type { Project } from './project';
import type { Workspace } from './workspace';

export const name = 'Environment';
export const type = 'Environment';
export const prefix = 'env';
// vault environment path when saved in environment data
export const vaultEnvironmentPath = '__insomnia_vault';
// vault environment path when used in runtime rendering
export const vaultEnvironmentRuntimePath = 'vault';
export const vaultEnvironmentMaskValue = '••••••';
export const canDuplicate = true;
export const canSync = true;
// for those keys do not need to add in model init method
export const optionalKeys = [
  'kvPairData',
  'environmentType',
];

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
  KVPAIR = 'kv'
};
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

export function getKVPairFromData(data: Record<string, any>, dataPropertyOrder: Record<string, any> | null) {
  const ordered = orderedJSON.order(data, dataPropertyOrder, JSON_ORDER_SEPARATOR);
  const kvPair: EnvironmentKvPairData[] = [];
  Object.keys(ordered).forEach(key => {
    const val = ordered[key];
    // get all secret items from vaultEnvironmentPath
    if (key === vaultEnvironmentPath && typeof val === 'object') {
      Object.keys(val).forEach(secretKey => {
        kvPair.push({
          id: generateId('envPair'),
          name: secretKey,
          value: val[secretKey],
          type: EnvironmentKvPairDataType.SECRET,
          enabled: true,
        });
      });
    } else {
      const isValidObject = val && typeof val === 'object' && data !== null;
      kvPair.push({
        id: generateId('envPair'),
        name: key,
        value: isValidObject ? JSON.stringify(val) : String(val),
        type: isValidObject ? EnvironmentKvPairDataType.JSON : EnvironmentKvPairDataType.STRING,
        enabled: true,
      });
    };
  });
  return kvPair;
}

export function getDataFromKVPair(kvPair: EnvironmentKvPairData[]) {
  const data: Record<string, any> = {};
  kvPair.forEach(pair => {
    const { name, value, type, enabled } = pair;
    if (enabled) {
      if (type === EnvironmentKvPairDataType.SECRET) {
        if (!data[vaultEnvironmentPath]) {
          // create object storing all secret items
          data[vaultEnvironmentPath] = {};
        };
        data[vaultEnvironmentPath][name] = value;
      } else {
        data[name] = type === EnvironmentKvPairDataType.JSON ? JSON.parse(value) : value;
      }
    }
  });
  return {
    data,
    dataPropertyOrder: null,
  };
}

// mask vault environment varibale if necessary
export const maskVaultEnvironmentData = (environment: Environment) => {
  if (environment.isPrivate) {
    const { data, kvPairData } = environment;
    const shouldMask = kvPairData?.some(pair => pair.type === EnvironmentKvPairDataType.SECRET);
    if (shouldMask) {
      kvPairData?.forEach(pair => {
        const { type } = pair;
        if (type === EnvironmentKvPairDataType.SECRET) {
          pair.value = vaultEnvironmentMaskValue;
        }
      });
      Object.keys(data[vaultEnvironmentPath]).forEach(vaultKey => {
        data[vaultEnvironmentPath][vaultKey] = vaultEnvironmentMaskValue;
      });
    }
  };
  return environment;
};

export const encryptSecretValue = (rawValue: string, symmetricKey: JsonWebKey) => {
  if (typeof symmetricKey !== 'object' || Object.keys(symmetricKey).length === 0) {
    // invalid symmetricKey
    return rawValue;
  }
  const encryptResult = crypt.encryptAES(symmetricKey, rawValue);
  const encryptedValue = base64encode(encryptResult);
  return encryptedValue;
};

export const decryptSecretValue = (encryptedValue: string, symmetricKey: JsonWebKey) => {
  if (typeof symmetricKey !== 'object' || Object.keys(symmetricKey).length === 0) {
    // invalid symmetricKey
    return encryptedValue;
  }
  try {
    const jsonWebKey = base64decode(encryptedValue, true);
    return crypt.decryptAES(symmetricKey, jsonWebKey);
  } catch (error) {
    // return origin value if failed to decrypt
    return encryptedValue;
  }
};

// remove all secret items when user reset vault key
export const removeAllSecrets = async (orgnizationIds: string[]) => {
  const allProjects = await db.find<Project>(project.type, {
    parentId: { $in: orgnizationIds },
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
  const allGloablPrivateEnvironments = allGlobalEnvironments.filter(env => env.isPrivate);
  allGloablPrivateEnvironments.forEach(async privateEnv => {
    const { kvPairData, data } = privateEnv;
    if (vaultEnvironmentPath in data) {
      const { [vaultEnvironmentPath]: secretData, ...restData } = data;
      const filteredKvPairData = kvPairData?.filter(kvPair => kvPair.type !== EnvironmentKvPairDataType.SECRET);
      await update(privateEnv, { data: restData, kvPairData: filteredKvPairData });
    }
  });
};

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
