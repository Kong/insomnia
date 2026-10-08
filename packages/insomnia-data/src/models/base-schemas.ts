import { z } from 'zod/v4';

import { type AllTypes, allTypesSchema, baseModelSchema } from './base-types';

export function createModelSchema<TType extends AllTypes, TPrefix extends string>(type: TType, _prefix: TPrefix) {
  return baseModelSchema.extend({
    type: allTypesSchema.extract([type]),
    isPrivate: baseModelSchema.shape.isPrivate.optional().default(false),
    name: baseModelSchema.shape.name.optional().default(''),
  });
}

// Basic literal types that can appear in JSON data
export const LiteralSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const KeyLiteralSchema = z.union([z.string(), z.number()]);

type Literal = z.infer<typeof LiteralSchema>;
type Json = Literal | { [key: string]: Json } | Json[];

// Recursive JSON schema that can handle nested objects and arrays
export const JsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([LiteralSchema, z.array(JsonSchema), z.record(KeyLiteralSchema, JsonSchema)]),
);
