import { z } from 'zod/v4';

type WalkableDef =
  | z.core.$ZodObjectDef
  | z.core.$ZodArrayDef
  | z.core.$ZodOptionalDef
  | z.core.$ZodNullableDef
  | z.core.$ZodDefaultDef
  | z.core.$ZodUnionDef
  | z.core.$ZodDiscriminatedUnionDef
  | z.core.$ZodRecordDef
  | z.core.$ZodTupleDef
  | z.core.$ZodIntersectionDef
  | z.core.$ZodLazyDef
  | z.core.$ZodPipeDef;

// Iterator and recursively apply strict mode to all nested Zod schemas
export function deepStrict<T extends z.ZodType>(schema: T): T {
  const def = schema.def as WalkableDef;
  switch (def.type) {
    case 'object': {
      const shape: Record<string, z.ZodType> = {};
      for (const key of Object.keys(def.shape)) {
        shape[key] = deepStrict(def.shape[key] as z.ZodType);
      }
      // Preserve an explicit catchall (e.g. `.passthrough()`/`.catchall(x)`) instead of
      // silently overriding the author's unknown-key handling; only default to `.strict()`
      let rebuilt: z.ZodObject = def.catchall
        ? z.object(shape).catchall(deepStrict(def.catchall as z.ZodType))
        : z.object(shape).strict();
      // Reattach any refinements/checks (e.g. `.refine()`/`.superRefine()`) attached to the
      // original object schema -- rebuilding via `z.object(shape)` otherwise drops them.
      for (const check of def.checks ?? []) {
        rebuilt = rebuilt.check(check as z.core.$ZodCheck<Record<string, unknown>>);
      }
      return rebuilt as unknown as T;
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
    case 'record': {
      return z.record(def.keyType, deepStrict(def.valueType as z.ZodType)) as unknown as T;
    }
    case 'tuple': {
      const items = def.items.map(item => deepStrict(item as z.ZodType)) as [z.ZodType, ...z.ZodType[]];
      return def.rest
        ? (z.tuple(items, deepStrict(def.rest as z.ZodType)) as unknown as T)
        : (z.tuple(items) as unknown as T);
    }
    case 'intersection': {
      return z.intersection(deepStrict(def.left as z.ZodType), deepStrict(def.right as z.ZodType)) as unknown as T;
    }
    case 'lazy': {
      // Keep the recursion lazy
      return z.lazy(() => deepStrict(def.getter() as z.ZodType)) as unknown as T;
    }
    case 'pipe': {
      // `.transform()` compiles down to a pipe whose `out` side is a `$ZodTransform` (a bare
      // function wrapper, not a shape to strictify) -- deepStrict is a no-op on it via the
      // default case below. Recursing into `in` is what makes e.g. `object.transform(fn)`
      // still reject unknown keys before the transform ever runs.
      return z.pipe(deepStrict(def.in as z.ZodType), deepStrict(def.out as z.ZodType)) as unknown as T;
    }
    default: {
      return schema;
    }
  }
}
