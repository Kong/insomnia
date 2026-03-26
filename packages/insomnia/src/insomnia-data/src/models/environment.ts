import type { BaseModel } from '~/models/types';

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
