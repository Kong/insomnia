import { z } from 'zod/v4';

import { baseModelSchema } from './base-schemas';
import type { BaseModel } from './base-types';
export const name = 'Unit Test';

export const type = 'UnitTest';

export const prefix = 'ut';

export const canDuplicate = true;

export const canSync = true;

export const BaseUnitTestSchema = z.object({
  name: z.string().optional().default(''),
  requestId: z.string().nullable().optional().default(null),
  code: z.string().optional().default(''),
  metaSortKey: z.number(),
});
export type BaseUnitTest = z.infer<typeof BaseUnitTestSchema>;

export const schema = baseModelSchema(type, prefix).extend(BaseUnitTestSchema.shape);
export type UnitTest = z.infer<typeof schema>;

export const isUnitTest = (model: Pick<BaseModel, 'type'>): model is UnitTest => model.type === type;

export function init(): BaseUnitTest {
  return {
    requestId: null,
    name: 'My Test',
    code: '',
    metaSortKey: -1 * Date.now(),
  };
}

export function rewriteReferences(doc: UnitTest, idMapping: Map<string, string>): UnitTest {
  return {
    ...doc,
    requestId: doc.requestId ? (idMapping.get(doc.requestId) ?? doc.requestId) : null,
  };
}
