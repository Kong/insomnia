import { models } from 'insomnia-data';
import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';

import { checkDocCompatibilityFromSchema, findDocUnknownFieldRanges } from '../zod/check-doc-compatibility';

// Like a real synced blob, there is no `modified`: hashDocument deletes it before the blob is stored.
const makeEnvironment = (extra: Record<string, unknown> = {}) => ({
  ...models.environment.init(),
  _id: 'env_1',
  type: models.environment.type,
  parentId: 'wrk_1',
  created: 1,
  ...extra,
});

// hashDocument also resets a workspace's `parentId` to null (see resetKeys in insomnia-data).
const makeWorkspace = (extra: Record<string, unknown> = {}) => ({
  ...models.workspace.init(),
  _id: 'wrk_1',
  type: models.workspace.type,
  parentId: null,
  created: 1,
  ...extra,
});

const toBlob = (doc: object) => JSON.stringify(doc);

// A request blob as it is stored by cloud sync.
const requestBlob = {
  _id: 'req_cc3d9e822ceb4eefbb7f74114b6e4860',
  authentication: {},
  body: {},
  created: 1_767_691_001_603,
  description: '',
  headers: [{ description: '', disabled: false, name: 'User-Agent', value: 'insomnia/12.2.0' }],
  isPrivate: false,
  metaSortKey: -1_767_335_591_505.5,
  method: 'GET',
  name: 'Request Tow',
  parameters: [],
  parentId: 'wrk_ad2095fbf3b14d76b638696336aef369',
  pathParameters: [],
  settingDisableRenderRequestBody: false,
  settingEncodeUrl: true,
  settingFollowRedirects: 'global',
  settingRebuildPath: true,
  settingSendCookies: true,
  settingStoreCookies: true,
  type: 'Request',
  url: 'https://httpbin.org/get',
};

describe('checkDocCompatibilityFromSchema on a stored request blob', () => {
  it('is ok for a blob that matches the Request schema', () => {
    expect(checkDocCompatibilityFromSchema(toBlob(requestBlob))).toBe('strict-match');
  });

  it('reports unknown-fields when the blob has a field this version does not know', () => {
    expect(checkDocCompatibilityFromSchema(toBlob({ ...requestBlob, addedByNewerVersion: 1 }))).toBe('match-with-unknown-fields');
  });

  it('reports unsupported when a known field has a value or format this version does not accept', () => {
    expect(checkDocCompatibilityFromSchema(toBlob({ ...requestBlob, method: 42 }))).toBe('mismatch');
    expect(checkDocCompatibilityFromSchema(toBlob({ ...requestBlob, headers: 'a-new-format' }))).toBe('mismatch');
  });

  it('reports unsupported when a required field is missing (e.g. renamed by a newer version)', () => {
    const { created: _renamed, ...withoutCreated } = requestBlob;
    expect(checkDocCompatibilityFromSchema(toBlob({ ...withoutCreated, createdAt: requestBlob.created }))).toBe(
      'mismatch',
    );
  });

  it('only reports unknown-fields when the renamed field has a default, since the old name is then optional', () => {
    const { url: _renamed, ...withoutUrl } = requestBlob;
    expect(checkDocCompatibilityFromSchema(toBlob({ ...withoutUrl, uri: requestBlob.url }))).toBe('match-with-unknown-fields');
  });

  it('highlights the unknown field in the diff text', () => {
    const blob = toBlob({ ...requestBlob, addedByNewerVersion: 1 });
    const yamlText = stringify(JSON.parse(blob));
    const line = yamlText.split('\n').findIndex(l => l.startsWith('addedByNewerVersion:')) + 1;

    expect(findDocUnknownFieldRanges(blob, yamlText)).toEqual([
      expect.objectContaining({ startLine: line, endLine: line, label: 'addedByNewerVersion' }),
    ]);
  });
});

describe('checkDocCompatibilityFromSchema on a stored workspace blob', () => {
  it('is ok even though hashDocument reset its parentId to null', () => {
    expect(checkDocCompatibilityFromSchema(toBlob(makeWorkspace()))).toBe('strict-match');
  });

  it('reports unknown-fields for a field this version does not know', () => {
    expect(checkDocCompatibilityFromSchema(toBlob(makeWorkspace({ addedByNewerVersion: true })))).toBe(
      'match-with-unknown-fields',
    );
  });

  it('reports unsupported for a scope added by a newer version', () => {
    expect(checkDocCompatibilityFromSchema(toBlob(makeWorkspace({ scope: 'a-scope-from-the-future' })))).toBe(
      'mismatch',
    );
  });
});

describe('checkDocCompatibilityFromSchema', () => {
  it('is ok for a doc that matches its model schema', () => {
    expect(checkDocCompatibilityFromSchema(toBlob(makeEnvironment()))).toBe('strict-match');
  });

  it('reports unknown-fields for a field its model schema does not know', () => {
    expect(checkDocCompatibilityFromSchema(toBlob(makeEnvironment({ addedByNewerVersion: true })))).toBe(
      'match-with-unknown-fields',
    );
  });

  it('reports unknown-fields for an unknown field nested inside a known one', () => {
    const doc = makeEnvironment({
      kvPairData: [{ id: 'a', name: 'k', value: 'v', type: 'str', enabled: true, future: 1 }],
    });
    expect(checkDocCompatibilityFromSchema(toBlob(doc))).toBe('match-with-unknown-fields');
  });

  it('prefers unsupported when a doc has both a mismatch and an unknown field', () => {
    expect(checkDocCompatibilityFromSchema(toBlob(makeEnvironment({ parentId: 123, extra: 1 })))).toBe('mismatch');
  });

  it('is ok for empty, invalid and non-object blobs', () => {
    expect(checkDocCompatibilityFromSchema()).toBe('strict-match');
    expect(checkDocCompatibilityFromSchema('')).toBe('strict-match');
    expect(checkDocCompatibilityFromSchema('null')).toBe('strict-match');
    expect(checkDocCompatibilityFromSchema('not json')).toBe('strict-match');
    expect(checkDocCompatibilityFromSchema('[]')).toBe('strict-match');
  });

  it('is ok for unknown model types, which have no schema to check against', () => {
    expect(checkDocCompatibilityFromSchema(toBlob({ _id: 'x_1', type: 'NotAModel', extra: 1 }))).toBe('strict-match');
  });

  it('returns the same result for repeated calls', () => {
    const blob = toBlob(makeEnvironment({ addedByNewerVersion: true }));
    expect(checkDocCompatibilityFromSchema(blob)).toBe('match-with-unknown-fields');
    expect(checkDocCompatibilityFromSchema(blob)).toBe('match-with-unknown-fields');
  });
});

describe('findDocUnknownFieldRanges', () => {
  it('highlights the unknown field in the YAML rendering of the doc', () => {
    const blob = toBlob(makeEnvironment({ addedByNewerVersion: { a: 1, b: 2 } }));
    const yamlText = stringify(JSON.parse(blob));
    const line = yamlText.split('\n').findIndex(l => l.startsWith('addedByNewerVersion:')) + 1;

    expect(findDocUnknownFieldRanges(blob, yamlText)).toEqual([
      expect.objectContaining({ startLine: line, endLine: line + 2, label: 'addedByNewerVersion' }),
    ]);
  });

  it('returns nothing for a clean doc, a missing blob or an unsupported doc', () => {
    const blob = toBlob(makeEnvironment());
    expect(findDocUnknownFieldRanges(blob, stringify(JSON.parse(blob)))).toEqual([]);
    expect(findDocUnknownFieldRanges(undefined, '{}')).toEqual([]);

    const unsupported = toBlob(makeEnvironment({ parentId: 123, extra: 1 }));
    expect(findDocUnknownFieldRanges(unsupported, stringify(JSON.parse(unsupported)))).toEqual([]);
  });
});
