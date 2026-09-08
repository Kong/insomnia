import { z } from 'zod/v4';

import { baseModelSchema } from './base-schemas';
import type { BaseModel } from './base-types';

export const name = 'Unit Test Suite';

export const type = 'UnitTestSuite';

export const prefix = 'uts';

export const canDuplicate = true;

export const canSync = true;

export const baseUnitTestSuiteSchema = z.object({
  name: z.string().optional().default(''),
  metaSortKey: z.number(),
});
export type BaseUnitTestSuite = z.infer<typeof baseUnitTestSuiteSchema>;

export const schema = baseModelSchema(type, prefix).extend(baseUnitTestSuiteSchema.shape);
export type UnitTestSuite = z.infer<typeof schema>;

export const isUnitTestSuite = (model: Pick<BaseModel, 'type'>): model is UnitTestSuite => model.type === type;

export function init(): BaseUnitTestSuite {
  return {
    name: 'My Test',
    metaSortKey: -1 * Date.now(),
  };
}
