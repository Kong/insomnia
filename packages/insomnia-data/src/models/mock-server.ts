import { z } from 'zod/v4';

import { baseModelSchema } from './base-schemas';
import type { BaseModel } from './base-types';

export const name = 'Mock Server';

export const type = 'MockServer';

export const prefix = 'mock';

export const canDuplicate = true;

export const canSync = true;

export const baseMockServerSchema = z.object({
  parentId: z.string(),
  name: z.string().optional().default(''),
  url: z.string(),
  useInsomniaCloud: z.boolean().default(true),
});
export type BaseMockServer = z.infer<typeof baseMockServerSchema>;

export const schema = baseModelSchema(type, prefix).extend(baseMockServerSchema.shape);
export type MockServer = z.infer<typeof schema>;

export function init(): BaseMockServer {
  return {
    parentId: '',
    name: 'New Mock',
    url: 'http://localhost:8080',
    useInsomniaCloud: true,
  };
}

export const isMockServer = (model: Pick<BaseModel, 'type'>): model is MockServer => model.type === type;
