import { z } from 'zod/v4';

import { JsonSchema } from '../../common-src';
import { type BaseModel, createModelSchema } from './base-types';

export const name = 'Cookie Jar';

export const type = 'CookieJar';

export const prefix = 'jar';

export const canDuplicate = true;

export const canSync = false;

// export interface Cookie {
//   expires: Date | string | number | null;
// }
export const CookieSchema = z.object({
  id: z
    .string()
    .optional()
    .default(() => crypto.randomUUID()),
  key: z.string().optional().default(''),
  value: z.string().optional().default(''),
  expires: z.preprocess(val => {
    // Handle 'Infinity' string
    if (val === 'Infinity') return null;

    // If it's already a Date, check if it's valid
    if (val instanceof Date) {
      return Number.isNaN(val.getTime()) ? null : val;
    }

    // Let other values pass through to z.coerce.date()
    return val;
  }, z.union([z.coerce.date(), z.literal('Infinity')]).nullable().default(null)),
  domain: z.string().optional().default(''),
  path: z.string().optional().default('/'),
  secure: z.boolean().optional().default(false),
  httpOnly: z.boolean().optional().default(false),
  extensions: z.array(JsonSchema).optional(),
  creation: z.coerce.date().optional(),
  creationIndex: z.number().optional(),
  hostOnly: z.boolean().optional(),
  pathIsDefault: z.boolean().optional(),
  lastAccessed: z.coerce.date().optional(),
  // 'manual' cookies (added/edited via the Cookie Jar UI, or written by a script) may contain
  // template syntax that gets rendered; 'response' cookies came from a server's Set-Cookie
  // header (or an import) and are always rendered as plain literal text.
  source: z.union([z.literal('manual'), z.literal('response')]).optional(),
});
export type Cookie = z.infer<typeof CookieSchema>;

export const baseCookieJarSchema = z.object({
  name: z.string().optional().default(''),
  cookies: z.array(CookieSchema).optional().default([]),
});
export type BaseCookieJar = z.infer<typeof baseCookieJarSchema>;

export const schema = createModelSchema(type, prefix).extend(baseCookieJarSchema.shape);
export type CookieJar = BaseModel & BaseCookieJar;

export const isCookieJar = (model: Pick<BaseModel, 'type'>): model is CookieJar => model.type === type;

export function init() {
  return {
    name: 'Default Jar',
    cookies: [],
  };
}
