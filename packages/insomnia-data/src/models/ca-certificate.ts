import { z } from 'zod/v4';

import { baseModelSchema } from './base-schemas';
import type { BaseModel } from './base-types';
export const name = 'CA Certificate';

export const type = 'CaCertificate';

export const prefix = 'crt';

export const canDuplicate = true;

export const canSync = false;

export const baseCACertificateSchema = z.object({
  parentId: z.string(),
  path: z.string().optional().nullable().default(''),
  disabled: z.boolean().default(false),
});
export type BaseCaCertificate = z.infer<typeof baseCACertificateSchema>;

export const schema = baseModelSchema(type, prefix).extend(baseCACertificateSchema.shape);
export type CaCertificate = z.infer<typeof schema>;

export function init(): BaseCaCertificate & Pick<BaseModel, 'isPrivate'> {
  return {
    parentId: '',
    disabled: false,
    path: null,
    isPrivate: false,
  };
}

export const isCaCertificate = (model: Pick<BaseModel, 'type'>): model is CaCertificate => model.type === type;
