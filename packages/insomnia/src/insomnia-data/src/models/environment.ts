import orderedJSON from 'json-order';

import * as crypt from '~/account/crypt';
import { JSON_ORDER_SEPARATOR } from '~/common/constants';
import { generateId } from '~/common/misc';
import { base64decode, base64encode } from '~/utils/vault';

import type { BaseModel } from './base-types';
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
    }
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
        }
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

// mask vault environment variable if necessary
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
  }
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
    const jsonWebKey = base64decode(encryptedValue, true) as crypt.AESMessage;
    return crypt.decryptAES(symmetricKey, jsonWebKey);
  } catch {
    // return origin value if failed to decrypt
    return encryptedValue;
  }
};
