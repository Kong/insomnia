import { z } from 'zod/v4';

import { type BaseModel, createModelSchema } from './base-types';
import { EnvironmentKvPairDataSchema, environmentTypeSchema } from './environment';
import { AuthenticationSchema, HeadersSchema } from './request';
import { replaceIdsInFields } from './utils/replace-ids-in-fields';

export const name = 'Folder';

export const type = 'RequestGroup';

export const prefix = 'fld';

export const canDuplicate = true;

export const canSync = true;
// for those keys do not need to add in model init method
export const optionalKeys: (keyof BaseRequestGroup)[] = [
  'kvPairData',
  'environmentType',
  'konnectRouteId',
  'environmentPropertyOrder',
];
export const baseRequestGroupSchema = z.object({
  name: z.string().optional().default(''),
  description: z.string().optional().default(''),
  environment: z.record(z.string(), z.any()).optional().default({}),
  environmentPropertyOrder: z.record(z.string(), z.any()).nullable().optional(),
  kvPairData: z.array(EnvironmentKvPairDataSchema).optional(),
  environmentType: environmentTypeSchema.optional(),
  metaSortKey: z.number(),
  preRequestScript: z.string().optional(),
  afterResponseScript: z.string().optional(),
  authentication: AuthenticationSchema.optional(),
  headers: HeadersSchema.optional(),
  konnectRouteId: z.string().nullable().optional(),
});
export type BaseRequestGroup = z.infer<typeof baseRequestGroupSchema>;

export const schema = createModelSchema(type, prefix).extend(baseRequestGroupSchema.shape);
export type RequestGroup = z.infer<typeof schema>;

export const isRequestGroup = (model: Pick<BaseModel, 'type'>): model is RequestGroup => model.type === type;
export const isRequestGroupId = (id?: string | null) => id?.startsWith(prefix);

export function init(): BaseRequestGroup {
  return {
    name: 'New Folder',
    description: '',
    environment: {},
    metaSortKey: -1 * Date.now(),
    preRequestScript: undefined,
    afterResponseScript: undefined,
    authentication: undefined,
    headers: undefined,
  };
}

export function rewriteReferences(group: RequestGroup, idMapping: Map<string, string>): RequestGroup {
  return {
    ...group,
    ...replaceIdsInFields(
      group,
      ['authentication', 'headers', 'preRequestScript', 'afterResponseScript', 'environment', 'kvPairData'],
      idMapping,
    ),
    konnectRouteId: null,
  };
}
