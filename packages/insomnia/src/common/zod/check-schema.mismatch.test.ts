import type { Request } from 'insomnia-data';
import { models } from 'insomnia-data';
import { describe, expect, it } from 'vitest';

import { checkStrictSchemaMatch } from './check-schema-mismatch';

function baseRequestDoc(overrides: Record<string, any> = {}): Request {
  return {
    _id: 'req_1',
    type: 'Request',
    parentId: 'fld_1',
    modified: 0,
    created: 0,
    isPrivate: false,
    name: 'Test',
    url: '',
    description: '',
    method: 'GET',
    body: {},
    parameters: [],
    headers: [],
    authentication: {},
    metaSortKey: 0,
    settingStoreCookies: true,
    settingSendCookies: true,
    settingDisableRenderRequestBody: false,
    settingEncodeUrl: true,
    settingRebuildPath: true,
    settingFollowRedirects: 'global',
    ...overrides,
  };
}

const requestSchema = models.request.schema;

describe('Check Strict Schema Match', () => {
  it('does not flag a baseline document with no unrecognized fields/values', () => {
    const result = checkStrictSchemaMatch(requestSchema, baseRequestDoc());
    expect(result.mismatch).toBe(false);
  });

  it('flags a document carrying a property not declared on the schema (unknown property)', () => {
    const result = checkStrictSchemaMatch(
      requestSchema,
      baseRequestDoc({ someFutureField: 'added in a later version', someFutureField1: 'added in a later version1' }),
    );
    expect(result.mismatch).toBe(true);
    expect(result.errors[0].code).toContain('unrecognized_keys');
    expect(result.errors[0].message).toContain('someFutureField');
    expect(result.errors[0].message).toContain('someFutureField1');
  });

  it('flags a document with an unrecognized authentication type', () => {
    const result = checkStrictSchemaMatch(
      requestSchema,
      baseRequestDoc({ authentication: { type: 'someFutureAuthType2026', apiKey: 'super-secret-value' } }),
    );
    expect(result.mismatch).toBe(true);
    expect(result.errors.some(error => error.message.includes('authentication.type'))).toBe(true);
  });

  it('flags an unknown property on the `body` sub-object', () => {
    const result = checkStrictSchemaMatch(
      requestSchema,
      baseRequestDoc({ body: { mimeType: 'text/plain', extraBodyField: 'x' } }),
    );
    expect(result.mismatch).toBe(true);
    expect(result.errors[0].code).toContain('unrecognized_keys');
    expect(result.errors[0].message).toContain('body');
    expect(result.errors[0].message).toContain('extraBodyField');
  });

  it('flags an unknown property on a `parameters` array item', () => {
    const result = checkStrictSchemaMatch(
      requestSchema,
      baseRequestDoc({ parameters: [{ name: 'foo', value: 'bar', extraParamField: 'x' }] }),
    );
    expect(result.mismatch).toBe(true);
    expect(result.errors[0].code).toContain('unrecognized_keys');
    expect(result.errors[0].message).toContain('parameters.0');
    expect(result.errors[0].message).toContain('extraParamField');
  });

  it('flags an unknown property on a `headers` array item', () => {
    const result = checkStrictSchemaMatch(
      requestSchema,
      baseRequestDoc({ headers: [{ name: 'X', value: 'Y', extraHeaderField: 'x' }] }),
    );
    expect(result.mismatch).toBe(true);
    expect(result.errors[0].code).toContain('unrecognized_keys');
    expect(result.errors[0].message).toContain('headers.0');
    expect(result.errors[0].message).toContain('extraHeaderField');
  });

  it('flags an unknown property on a `pathParameters` array item', () => {
    const result = checkStrictSchemaMatch(
      requestSchema,
      baseRequestDoc({ pathParameters: [{ name: 'id', value: '1', extraPathParamField: 'x' }] }),
    );
    expect(result.mismatch).toBe(true);
    expect(result.errors[0].code).toContain('unrecognized_keys');
    expect(result.errors[0].message).toContain('pathParameters.0');
    expect(result.errors[0].message).toContain('extraPathParamField');
  });
});
