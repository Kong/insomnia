import { z } from 'zod/v4';

import { createModelSchema } from './base-schemas';
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
export const optionalKeys: (keyof BaseEnvironment)[] = ['kvPairData', 'environmentType', 'dataPropertyOrder'];

export enum EnvironmentType {
  JSON = 'json',
  KVPAIR = 'kv',
}

export enum EnvironmentKvPairDataType {
  JSON = 'json',
  STRING = 'str',
  SECRET = 'secret',
}

export const EnvironmentKvPairDataSchema = z.object({
  id: z.string(),
  name: z.string().optional().default(''),
  value: z.string().optional().default(''),
  type: z.enum([EnvironmentKvPairDataType.JSON, EnvironmentKvPairDataType.STRING, EnvironmentKvPairDataType.SECRET]),
  enabled: z.boolean().optional(),
});
export type EnvironmentKvPairData = z.infer<typeof EnvironmentKvPairDataSchema>;

export const environmentTypeSchema = z.enum([EnvironmentType.JSON, EnvironmentType.KVPAIR]);
export const baseEnvironmentSchema = z.object({
  name: z.string().optional().default(''),
  data: z.record(z.string(), z.any()).optional().default({}),
  color: z.string().optional().nullable(),
  dataPropertyOrder: z.record(z.string(), z.any()).nullable().optional(),
  kvPairData: z.array(EnvironmentKvPairDataSchema).optional(),
  metaSortKey: z
    .number()
    .optional()
    .default(() => Date.now()),
  environmentType: environmentTypeSchema.optional(),
});
export type BaseEnvironment = z.infer<typeof baseEnvironmentSchema>;

export const schema = createModelSchema(type, prefix).extend(baseEnvironmentSchema.shape);
export type Environment = z.infer<typeof schema>;

// This is a representation of the data taken from a csv or json file AKA iterationData
export type UserUploadEnvironment = Pick<Environment, 'data' | 'dataPropertyOrder' | 'name'>;

export const isEnvironmentId = (id?: string | null) => id?.startsWith(`${prefix}_`);

export const isEnvironment = (model: Pick<BaseModel, 'type'>): model is Environment => model.type === type;

export function init() {
  return {
    name: 'New Environment',
    data: {},
    color: null,
    isPrivate: false,
    metaSortKey: Date.now(),
  };
}
