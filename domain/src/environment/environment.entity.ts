import type { Entity } from '../shared/entity';

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

export interface Environment extends Entity {
  type: 'Environment';
  name: string;
  data: Record<string, any>;
  dataPropertyOrder?: Record<string, any> | null;
  kvPairData?: EnvironmentKvPairData[];
  color: string | null;
  metaSortKey: number;
  environmentType?: EnvironmentType;
}
