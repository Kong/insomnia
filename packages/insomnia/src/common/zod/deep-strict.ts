import { z } from 'zod/v4';

type WalkableDef =
  | z.core.$ZodObjectDef
  | z.core.$ZodArrayDef
  | z.core.$ZodOptionalDef
  | z.core.$ZodNullableDef
  | z.core.$ZodDefaultDef
  | z.core.$ZodUnionDef
  | z.core.$ZodDiscriminatedUnionDef;

// Iterator and recursively apply strict mode to all nested Zod schemas
export function deepStrict<T extends z.ZodType>(schema: T): T {
  const def = schema.def as WalkableDef;
  switch (def.type) {
    case 'object': {
      const shape: Record<string, z.ZodType> = {};
      for (const key of Object.keys(def.shape)) {
        shape[key] = deepStrict(def.shape[key] as z.ZodType);
      }
      return z.object(shape).strict() as unknown as T;
    }
    case 'array': {
      return deepStrict(def.element as z.ZodType).array() as unknown as T;
    }
    case 'optional': {
      return deepStrict(def.innerType as z.ZodType).optional() as unknown as T;
    }
    case 'nullable': {
      return deepStrict(def.innerType as z.ZodType).nullable() as unknown as T;
    }
    case 'default': {
      return deepStrict(def.innerType as z.ZodType).default(def.defaultValue) as unknown as T;
    }
    case 'union': {
      const options = def.options.map(option => deepStrict(option as z.ZodType));
      return 'discriminator' in def
        ? (z.discriminatedUnion(
            def.discriminator,
            options as unknown as [z.core.$ZodTypeDiscriminable, ...z.core.$ZodTypeDiscriminable[]],
          ) as unknown as T)
        : (z.union(options) as unknown as T);
    }
    default: {
      return schema;
    }
  }
}
