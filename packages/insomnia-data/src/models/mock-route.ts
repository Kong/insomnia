import { z } from 'zod/v4';

import { baseModelSchema } from './base-schemas';
import type { BaseModel } from './base-types';
import { requestHeaderSchema } from './request';

export const name = 'Mock Route';

export const type = 'MockRoute';

export const prefix = 'mock-route';

export const canDuplicate = true;

export const canSync = true;

export const baseMockRouteSchema = z.object({
  name: z.string().optional().default('/'),
  body: z.string().optional().default(''),
  headers: z.array(requestHeaderSchema).optional().default([]),
  // used only for sending the testing request
  method: z.string().optional().default('GET'),
  mimeType: z.string().optional().default('application/json'),
  statusCode: z.number().optional().default(200),
  statusText: z.string().optional().default(''),
  parentId: z.string(),
});
export type BaseMockRoute = z.infer<typeof baseMockRouteSchema>;

export const schema = baseModelSchema(type, prefix).extend(baseMockRouteSchema.shape);
export type MockRoute = BaseModel & BaseMockRoute;

export function init(): BaseMockRoute {
  return {
    body: '',
    headers: [],
    parentId: '',
    statusCode: 200,
    statusText: '',
    name: '/',
    mimeType: 'application/json',
    method: 'GET',
  };
}

export const isMockRoute = (model: Pick<BaseModel, 'type'>): model is MockRoute => model.type === type;
