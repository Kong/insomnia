import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { deepStrict } from './deep-strict';

describe('deepStrict', () => {
  it('makes a plain object strict', () => {
    const schema = deepStrict(z.object({ name: z.string() }));
    expect(schema.safeParse({ name: 'a' }).success).toBe(true);
    expect(schema.safeParse({ name: 'a', extra: 'x' }).success).toBe(false);
  });

  it('recurses into a nested object property', () => {
    const schema = deepStrict(
      z.object({
        name: z.string(),
        nested: z.object({ value: z.string() }),
      }),
    );
    expect(schema.safeParse({ name: 'a', nested: { value: 'b' } }).success).toBe(true);
    expect(schema.safeParse({ name: 'a', nested: { value: 'b', extra: 'x' } }).success).toBe(false);
  });

  it('recurses into array elements', () => {
    const schema = deepStrict(z.array(z.object({ value: z.string() })));
    expect(schema.safeParse([{ value: 'a' }]).success).toBe(true);
    expect(schema.safeParse([{ value: 'a', extra: 'x' }]).success).toBe(false);
  });

  it('preserves optional() while still strictifying the inner object', () => {
    const schema = deepStrict(z.object({ value: z.string() }).optional());
    expect(schema.safeParse({ value: 'a' }).success).toBe(true);
    expect(schema.safeParse({ value: 'a', extra: 'x' }).success).toBe(false);
  });

  it('preserves nullable() while still strictifying the inner object', () => {
    const schema = deepStrict(z.object({ value: z.string() }).nullable());
    expect(schema.safeParse(null).success).toBe(true);
    expect(schema.safeParse({ value: 'a' }).success).toBe(true);
    expect(schema.safeParse({ value: 'a', extra: 'x' }).success).toBe(false);
  });

  it('strictifies every branch of a plain union', () => {
    const schema = deepStrict(z.union([z.object({ a: z.string() }), z.object({ b: z.string() })]));
    expect(schema.safeParse({ a: 'x' }).success).toBe(true);
    expect(schema.safeParse({ b: 'x' }).success).toBe(true);
    expect(schema.safeParse({ a: 'x', extra: 'x' }).success).toBe(false);
    expect(schema.safeParse({ b: 'x', extra: 'x' }).success).toBe(false);
  });

  it('strictifies every branch of a discriminated union while keeping the discriminator working', () => {
    const schema = deepStrict(
      z.discriminatedUnion('type', [
        z.object({ type: z.literal('a'), value: z.string() }),
        z.object({ type: z.literal('b'), count: z.number() }),
      ]),
    );
    expect(schema.safeParse({ type: 'a', value: 'x' }).success).toBe(true);
    expect(schema.safeParse({ type: 'b', count: 1 }).success).toBe(true);
    expect(schema.safeParse({ type: 'a', value: 'x', extra: 'x' }).success).toBe(false);
    expect(schema.safeParse({ type: 'b', count: 1, extra: 'x' }).success).toBe(false);
  });

  it('leaves non-object, non-container schemas (e.g. plain string) untouched', () => {
    const schema = deepStrict(z.string());
    expect(schema.safeParse('hello').success).toBe(true);
    expect(schema.safeParse(1).success).toBe(false);
  });

  it('leaves each option of a primitive union untouched while reconstructing the union', () => {
    const schema = deepStrict(z.union([z.string(), z.number()]));
    expect(schema.safeParse('hello').success).toBe(true);
    expect(schema.safeParse(1).success).toBe(true);
    expect(schema.safeParse(true).success).toBe(false);
  });

  it('handles a combination of wrappers: optional array of strict objects', () => {
    const schema = deepStrict(z.array(z.object({ value: z.string() })).optional());
    expect(schema.safeParse([{ value: 'a' }]).success).toBe(true);
    expect(schema.safeParse([{ value: 'a', extra: 'x' }]).success).toBe(false);
  });

  it('recurses into the value schema of a record', () => {
    const schema = deepStrict(z.record(z.string(), z.object({ value: z.string() })));
    expect(schema.safeParse({ k: { value: 'a' } }).success).toBe(true);
    expect(schema.safeParse({ k: { value: 'a', extra: 'x' } }).success).toBe(false);
  });

  it('recurses into tuple items and the rest element', () => {
    const schema = deepStrict(z.tuple([z.object({ value: z.string() })], z.object({ tag: z.string() })));
    expect(schema.safeParse([{ value: 'a' }, { tag: 'x' }]).success).toBe(true);
    expect(schema.safeParse([{ value: 'a', extra: 'x' }]).success).toBe(false);
    expect(schema.safeParse([{ value: 'a' }, { tag: 'x', extra: 'x' }]).success).toBe(false);
  });

  it('recurses into both sides of an intersection', () => {
    // Note: zod's strict-object validation is applied independently to each side of an
    // intersection, so intersecting two *disjoint-key* strict objects can never succeed
    // (each side rejects the other side's keys as unrecognized) -- that's an inherent zod
    // limitation, not something deepStrict introduces. Use matching shapes on both sides so
    // the test isolates deepStrict's own recursion behavior instead of that limitation.
    const schema = deepStrict(
      z.intersection(
        z.object({ value: z.object({ nested: z.string() }) }),
        z.object({ value: z.object({ nested: z.string() }) }),
      ),
    );
    expect(schema.safeParse({ value: { nested: 'x' } }).success).toBe(true);
    expect(schema.safeParse({ value: { nested: 'x', extra: 'z' } }).success).toBe(false);
  });

  it('recurses into a lazy (self-referential) schema without infinite looping', () => {
    interface Tree {
      value: string;
      children?: Tree[];
    }
    const TreeSchema: z.ZodType<Tree> = z.lazy(() =>
      z.object({
        value: z.string(),
        children: z.array(TreeSchema).optional(),
      }),
    );
    const schema = deepStrict(TreeSchema);
    expect(schema.safeParse({ value: 'a', children: [{ value: 'b' }] }).success).toBe(true);
    expect(TreeSchema.safeParse({ value: 'a', children: [{ value: 'b', extra: 'x' }] }).success).toBe(true);
    expect(schema.safeParse({ value: 'a', children: [{ value: 'b', extra: 'x' }] }).success).toBe(false);
    expect(schema.safeParse({ value: 'a', extra: 'x' }).success).toBe(false);
  });

  it('preserves a refinement attached to the original object schema', () => {
    const schema = deepStrict(
      z.object({ a: z.number(), b: z.number() }).refine(d => d.a < d.b, 'a must be less than b'),
    );
    expect(schema.safeParse({ a: 1, b: 2 }).success).toBe(true);
    expect(schema.safeParse({ a: 5, b: 1 }).success).toBe(false);
    // the refinement doesn't loosen strictness -- unknown keys are still rejected
    expect(schema.safeParse({ a: 1, b: 2, extra: 'x' }).success).toBe(false);
  });

  it('preserves an explicit catchall schema instead of forcing every unknown key closed', () => {
    const schema = deepStrict(z.object({ value: z.string() }).catchall(z.number()));
    expect(schema.safeParse({ value: 'a', extra: 1 }).success).toBe(true);
    expect(schema.safeParse({ value: 'a', extra: 'not-a-number' }).success).toBe(false);
  });

  it('recurses into a nested object inside a catchall schema', () => {
    const schema = deepStrict(z.object({ value: z.string() }).catchall(z.object({ nested: z.string() })));
    expect(schema.safeParse({ value: 'a', extra: { nested: 'x' } }).success).toBe(true);
    expect(schema.safeParse({ value: 'a', extra: { nested: 'x', bad: 'y' } }).success).toBe(false);
  });

  it('leaves omit() alone since it already compiles down to a plain strict-able object', () => {
    const schema = deepStrict(z.object({ a: z.string(), b: z.object({ nested: z.string() }) }).omit({ a: true }));
    expect(schema.safeParse({ b: { nested: 'x' } }).success).toBe(true);
    expect(schema.safeParse({ b: { nested: 'x' }, a: 'y' } as any).success).toBe(false);
    expect(schema.safeParse({ b: { nested: 'x', extra: 'y' } }).success).toBe(false);
  });

  it('recurses into the input side of a transform pipe (rejects unknown keys before the transform runs)', () => {
    const schema = deepStrict(
      z
        .object({ a: z.string(), nested: z.object({ value: z.string() }) })
        .transform(d => ({ ...d, computed: d.a.length })),
    );
    expect(schema.safeParse({ a: 'x', nested: { value: 'y', extra: 'z' } }).success).toBe(false);
    expect(schema.safeParse({ a: 'x', nested: { value: 'y' }, extraTop: 'z' } as any).success).toBe(false);
    const result = schema.safeParse({ a: 'x', nested: { value: 'y' } });
    expect(result.success).toBe(true);
    // the transform itself still runs on the strictified input
    expect(result.success && result.data.computed).toBe(1);
  });

  it('recurses into both sides of a raw z.pipe()', () => {
    const schema = deepStrict(
      z.pipe(
        z.object({ nested: z.object({ value: z.string() }) }),
        z.object({ nested: z.object({ value: z.string() }) }),
      ),
    );
    expect(schema.safeParse({ nested: { value: 'x' } }).success).toBe(true);
    expect(schema.safeParse({ nested: { value: 'x', extra: 'y' } }).success).toBe(false);
  });
});

// A composite schema shaped like the real request.ts model
describe('deepStrict on a request-like composite schema', () => {
  const AuthTypeBasicSchema = z.object({
    type: z.literal('basic'),
    username: z.string().optional(),
    password: z.string().optional(),
  });
  const AuthTypeBearerSchema = z.object({
    type: z.literal('bearer'),
    token: z.string().optional(),
  });
  const AuthenticationSchema = z.union([
    z.discriminatedUnion('type', [AuthTypeBasicSchema, AuthTypeBearerSchema]),
    z.object({}),
  ]);
  const HeaderSchema = z.object({ name: z.string(), value: z.string() });
  const BodyParamSchema = z.object({ name: z.string(), value: z.string().optional() });
  const BodySchema = z.object({
    mimeType: z.string().nullable().optional(),
    params: z.array(BodyParamSchema).optional(),
  });
  const RequestLikeSchema = z.object({
    name: z.string(),
    metaSortKey: z.number(),
    body: BodySchema.optional().default({}),
    headers: z.array(HeaderSchema).optional().default([]),
    authentication: AuthenticationSchema.optional().default({}),
  });

  const strictSchema = deepStrict(RequestLikeSchema);

  function baseDoc(overrides: Record<string, any> = {}): Record<string, any> {
    return {
      name: 'Test',
      metaSortKey: 0,
      body: { mimeType: 'application/json', params: [{ name: 'a', value: '1' }] },
      headers: [{ name: 'X', value: 'Y' }],
      authentication: { type: 'basic', username: 'u' },
      ...overrides,
    };
  }

  it('accepts a fully valid request-like document', () => {
    expect(strictSchema.safeParse(baseDoc()).success).toBe(true);
  });

  it('rejects an unknown top-level key', () => {
    expect(strictSchema.safeParse(baseDoc({ extraTopLevel: 'x' })).success).toBe(false);
  });

  it('rejects an unknown key nested inside the body object', () => {
    const doc = baseDoc();
    doc.body = { ...doc.body, extraBodyField: 'x' };
    expect(strictSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects an unknown key two levels deep inside a body.params array item', () => {
    const doc = baseDoc();
    doc.body = { ...doc.body, params: [{ name: 'a', extraParamField: 'x' }] };
    expect(strictSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects an unknown key on a headers array item', () => {
    const doc = baseDoc();
    doc.headers = [{ name: 'X', value: 'Y', extraHeaderField: 'x' }];
    expect(strictSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects an unknown key on the matched branch of the authentication union', () => {
    const doc = baseDoc();
    doc.authentication = { type: 'basic', username: 'u', extraAuthField: 'x' };
    expect(strictSchema.safeParse(doc).success).toBe(false);
  });

  it('accepts the empty-object fallback branch of authentication when it carries no keys', () => {
    expect(strictSchema.safeParse(baseDoc({ authentication: {} })).success).toBe(true);
  });

  it('rejects an unrecognized authentication type across every union branch instead of silently stripping it', () => {
    const doc = baseDoc({ authentication: { type: 'someFutureAuthType', apiKey: 'secret' } });
    const result = strictSchema.safeParse(doc);
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    // The discriminated union has no matching discriminator, and the permissive `z.object({})`
    // fallback is strict too now, so it rejects the unrecognized `type`/`apiKey` keys instead of
    // silently stripping them -- both branches fail, surfacing as one `invalid_union` issue.
    const authIssue = result.error.issues.find(issue => issue.path[0] === 'authentication');
    expect(authIssue?.code).toBe('invalid_union');
  });

  it('omit and extend should preserve strictness', () => {
    const newSchema = RequestLikeSchema.omit({
      metaSortKey: true,
    }).extend({
      newField: z
        .object({
          foo: z.string(),
          bar: z.string(),
        })
        .optional(),
    });
    const doc = baseDoc({
      newField: { foo: 'x', bar: 'y', extra: 'extra' },
    });
    expect(newSchema.safeParse(doc).success).toBe(true);
    const strictSchema = deepStrict(newSchema);
    const strictResult = strictSchema.safeParse(doc);
    expect(strictResult.success).toBe(false);
    expect(strictResult.error?.issues.find(issue => issue.path[0] === 'newField')?.code).toBe('unrecognized_keys');
    expect(strictResult.error?.issues.length).toBe(2);
  });
});
