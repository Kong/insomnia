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
});
