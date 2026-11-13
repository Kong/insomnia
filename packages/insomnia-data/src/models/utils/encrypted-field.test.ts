import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { encrypted, encryptedFieldRegistry, getEncryptedFieldPaths } from './encrypted-field';

describe('getEncryptedFieldPaths()', () => {
  it('collects marked fields, nested through objects', () => {
    const schema = z.object({
      name: z.string(),
      passphrase: encrypted(z.string()),
      authentication: z.object({ username: z.string(), password: encrypted(z.string()) }),
    });
    expect(getEncryptedFieldPaths(schema)).toEqual(['authentication.password', 'passphrase']);
  });

  it('returns nothing for a schema without marks', () => {
    expect(getEncryptedFieldPaths(z.object({ a: z.string(), b: z.object({ c: z.array(z.string()) }) }))).toEqual([]);
  });

  it('uses [] for array elements', () => {
    const schema = z.object({
      cookies: z.array(z.object({ key: z.string(), value: encrypted(z.string()) })),
      nested: z.array(z.object({ inner: z.array(z.object({ secret: encrypted(z.string()) })) })),
    });
    expect(getEncryptedFieldPaths(schema)).toEqual(['cookies[].value', 'nested[].inner[].secret']);
  });

  it('supports an array of marked strings', () => {
    expect(getEncryptedFieldPaths(z.object({ tokens: z.array(encrypted(z.string())) }))).toEqual(['tokens[]']);
  });

  it('uses [][] for arrays of arrays', () => {
    const schema = z.object({
      a: z.array(z.array(encrypted(z.string()))),
      b: z.array(z.array(z.object({ s: encrypted(z.string()) }).optional())),
    });
    expect(getEncryptedFieldPaths(schema)).toEqual(['a[][]', 'b[][].s']);
  });

  describe('where the mark has to sit', () => {
    it('survives wrappers added after encrypted()', () => {
      expect(
        getEncryptedFieldPaths(z.object({ f: encrypted(z.string().min(1).trim()).optional().nullable() })),
      ).toEqual(['f']);
    });

    it('survives .describe() and .meta() after encrypted(), which copy the node but remember the original', () => {
      expect(getEncryptedFieldPaths(z.object({ a: encrypted(z.string()).describe('x') }))).toEqual(['a']);
      expect(getEncryptedFieldPaths(z.object({ b: encrypted(z.string()).meta({ title: 'x' }).optional() }))).toEqual([
        'b',
      ]);
    });
  });

  it('sees through optional, nullable, default, readonly and nested wrappers', () => {
    const schema = z.object({
      a: encrypted(z.string()).optional(),
      b: encrypted(z.string()).nullable(),
      c: encrypted(z.string()).optional().default(''),
      d: encrypted(z.string()).nullable().optional().readonly(),
      e: z
        .object({ f: encrypted(z.string()) })
        .optional()
        .default({ f: '' }),
      g: z
        .array(z.object({ h: encrypted(z.string()) }))
        .optional()
        .default([]),
    });
    expect(getEncryptedFieldPaths(schema)).toEqual(['a', 'b', 'c', 'd', 'e.f', 'g[].h']);
  });

  it('accepts the mark on a wrapper layer as well as on the inner string', () => {
    const schema = z.object({ a: encrypted(z.string().optional()), b: encrypted(z.string().nullable().default('')) });
    expect(getEncryptedFieldPaths(schema)).toEqual(['a', 'b']);
  });

  it('sees through pipes and preprocess', () => {
    const schema = z.object({
      a: z.preprocess(value => value, encrypted(z.string())),
      b: encrypted(z.string()).transform(value => value),
      c: z.object({ d: encrypted(z.string()) }).transform(value => value),
    });
    expect(getEncryptedFieldPaths(schema)).toEqual(['a', 'b', 'c.d']);
  });

  it('merges union and discriminated union options by field name', () => {
    const schema = z.object({
      authentication: z.union([
        z.discriminatedUnion('type', [
          z.object({ type: z.literal('basic'), username: z.string(), password: encrypted(z.string()) }),
          z.object({ type: z.literal('digest'), password: encrypted(z.string()) }),
          // `key` is a secret here but a harmless header name below; it is encrypted in both
          z.object({ type: z.literal('hawk'), key: encrypted(z.string()) }),
          z.object({ type: z.literal('apikey'), key: z.string(), value: encrypted(z.string()) }),
          z.object({ type: z.literal('none') }),
        ]),
        z.object({}),
      ]),
    });
    expect(getEncryptedFieldPaths(schema)).toEqual([
      'authentication.key',
      'authentication.password',
      'authentication.value',
    ]);
  });

  it('merges both sides of an intersection', () => {
    const schema = z.intersection(z.object({ a: encrypted(z.string()) }), z.object({ b: encrypted(z.string()) }));
    expect(getEncryptedFieldPaths(schema)).toEqual(['a', 'b']);
  });

  it('works on schemas built with extend() and spread shapes', () => {
    const base = z.object({ secret: encrypted(z.string()), plain: z.string() });
    const extended = z
      .object({ _id: z.string() })
      .extend(base.shape)
      .extend({ other: encrypted(z.string()) });
    expect(getEncryptedFieldPaths(extended)).toEqual(['other', 'secret']);
  });

  it('returns sorted, de-duplicated paths', () => {
    const shared = encrypted(z.string());
    const schema = z.object({
      z: shared,
      a: encrypted(z.string()),
      u: z.union([z.object({ a: shared }), z.object({ a: shared })]),
    });
    expect(getEncryptedFieldPaths(schema)).toEqual(['a', 'u.a', 'z']);
  });

  it('terminates on recursive schemas', () => {
    type Json = string | number | Json[] | { [key: string]: Json };
    const json: z.ZodType<Json> = z.lazy(() =>
      z.union([z.string(), z.number(), z.array(json), z.record(z.string(), json)]),
    );
    const schema = z.object({ extensions: z.array(json), secret: encrypted(z.string()) });
    expect(getEncryptedFieldPaths(schema)).toEqual(['secret']);
  });

  it('collects a marked field behind a lazy schema', () => {
    const schema = z.object({ a: z.lazy(() => z.object({ b: encrypted(z.string()) })) });
    expect(getEncryptedFieldPaths(schema)).toEqual(['a.b']);
  });

  describe('throws instead of silently leaving a secret unencrypted', () => {
    it.each([
      ['number', z.number()],
      ['boolean', z.boolean()],
      ['enum', z.enum(['a', 'b'])],
      ['literal', z.literal('a')],
      ['unknown', z.unknown()],
      ['object', z.object({ a: z.string() })],
      ['array', z.array(z.string())],
      ['optional number', z.number().optional()],
    ])('marked %s', (_name, inner) => {
      expect(() => getEncryptedFieldPaths(z.object({ field: encrypted(inner as z.ZodType) }))).toThrow(/field/);
    });

    it('marked field inside a record, tuple, map or set', () => {
      expect(() => getEncryptedFieldPaths(z.object({ r: z.record(z.string(), encrypted(z.string())) }))).toThrow(/r/);
      expect(() => getEncryptedFieldPaths(z.object({ t: z.tuple([encrypted(z.string())]) }))).toThrow(/t/);
      expect(() => getEncryptedFieldPaths(z.object({ m: z.map(z.string(), encrypted(z.string())) }))).toThrow(/m/);
      expect(() => getEncryptedFieldPaths(z.object({ s: z.set(encrypted(z.string())) }))).toThrow(/s/);
      expect(() =>
        getEncryptedFieldPaths(z.object({ r: z.record(z.string(), z.object({ deep: encrypted(z.string()) })) })),
      ).toThrow(/r\.deep/);
    });

    it('marked field in the catchall of an object, which no path can address', () => {
      expect(() => getEncryptedFieldPaths(z.object({ a: z.string() }).catchall(encrypted(z.string())))).toThrow(/root/);
      expect(() =>
        getEncryptedFieldPaths(z.object({ o: z.object({ a: z.string() }).catchall(encrypted(z.string())) })),
      ).toThrow(/o/);
    });

    it('an object with an unmarked catchall is fine, including loose and strict objects', () => {
      expect(getEncryptedFieldPaths(z.object({ a: encrypted(z.string()) }).catchall(z.string()))).toEqual(['a']);
      expect(getEncryptedFieldPaths(z.looseObject({ a: encrypted(z.string()) }))).toEqual(['a']);
      expect(getEncryptedFieldPaths(z.strictObject({ a: encrypted(z.string()) }))).toEqual(['a']);
    });

    it('a union option that is not a string', () => {
      expect(() => getEncryptedFieldPaths(z.object({ a: encrypted(z.union([z.string(), z.number()])) }))).toThrow(
        /number/,
      );
    });

    it('a marked root', () => {
      expect(() => getEncryptedFieldPaths(encrypted(z.string()))).toThrow(/root/);
    });

    // Stands in for a node kind that a newer Zod adds: it must never be skipped, or a marked field inside it would
    // silently stay plaintext
    describe('a Zod node kind this file does not know', () => {
      const unknownNode = (def: Record<string, unknown>) => ({ _zod: { def: { type: 'brand_new_kind', ...def } } });

      it('throws on an unknown wrapper that hides a marked field', () => {
        const wrapper = unknownNode({ innerType: encrypted(z.string()) });
        expect(() => getEncryptedFieldPaths(z.object({ secret: wrapper as unknown as z.ZodType }))).toThrow(
          /secret.*brand_new_kind/,
        );
      });

      it('throws on an unknown leaf even when nothing is marked', () => {
        expect(() => getEncryptedFieldPaths(z.object({ a: unknownNode({}) as unknown as z.ZodType }))).toThrow(
          /brand_new_kind/,
        );
      });

      it('throws on an unknown kind in a union option, array element or lazy target', () => {
        const unknown = unknownNode({}) as unknown as z.ZodType;
        expect(() => getEncryptedFieldPaths(z.object({ a: z.union([z.string(), unknown]) }))).toThrow(/brand_new_kind/);
        expect(() => getEncryptedFieldPaths(z.object({ a: z.array(unknown) }))).toThrow(/brand_new_kind/);
        expect(() => getEncryptedFieldPaths(z.object({ a: z.lazy(() => unknown) }))).toThrow(/brand_new_kind/);
      });
    });
  });

  it('does not leak the marks into the published JSON schema', () => {
    const schema = z.object({ password: encrypted(z.string()).optional() });
    expect(JSON.stringify(z.toJSONSchema(schema))).not.toContain('encrypted');
    expect(encryptedFieldRegistry.has(schema.shape.password.unwrap() as z.ZodType)).toBe(true);
  });
});
