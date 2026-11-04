import { z } from 'zod/v4';

// Basic literal types that can appear in JSON data
export const LiteralSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const KeyLiteralSchema = z.union([z.string(), z.number()]);

type Literal = z.infer<typeof LiteralSchema>;
type Json = Literal | { [key: string]: Json } | Json[];

// Recursive JSON schema that can handle nested objects and arrays
export const JsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([LiteralSchema, z.array(JsonSchema), z.record(KeyLiteralSchema, JsonSchema)]),
);
