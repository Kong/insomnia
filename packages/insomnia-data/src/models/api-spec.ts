import { strings } from 'insomnia-data/common';
import { z } from 'zod/v4';

import { baseModelSchema } from './base-schemas';
import type { BaseModel } from './base-types';

export const name = 'ApiSpec';

export const type = 'ApiSpec';

export const prefix = 'spc';

export const canDuplicate = true;

export const canSync = true;

export const baseApiSpecSchema = z.object({
  fileName: z.string(),
  contentType: z.enum(['json', 'yaml']),
  contents: z.string().default(''),
});
export type BaseApiSpec = z.infer<typeof baseApiSpecSchema>;

export const schema = baseModelSchema(type, prefix).extend(baseApiSpecSchema.shape);
export type ApiSpec = BaseModel & BaseApiSpec;

export const isApiSpec = (model: Pick<BaseModel, 'type'>): model is ApiSpec => model.type === type;

export function init(): BaseApiSpec {
  return {
    fileName: `New ${strings.document.singular}`,
    contents: '',
    contentType: 'yaml',
  };
}
