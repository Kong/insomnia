import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';

import { computeFieldChanges, computeVisualDiff, diffByKey, getBaseEnvironmentId, ownFields } from './diff-engine';

const file = (collection: unknown[]) =>
  stringify({ type: 'collection.insomnia.rest/5.0', name: 'C', meta: { id: 'wrk_1' }, collection });

describe('computeVisualDiff', () => {
  it('is unparseable when one side has content that is not valid YAML (eg. conflict markers)', () => {
    const before = file([{ name: 'r', url: 'https://a', meta: { id: 'req_1' } }]);
    const conflicted = `${before}<<<<<<< HEAD\n  - url: https://ours\n=======\n  - url: https://theirs\n>>>>>>> main\n`;

    expect(computeVisualDiff(before, conflicted).unparseable).toBe(true);
  });

  it('treats an empty side as a legitimately absent file (new or deleted), not unparseable', () => {
    const after = file([{ name: 'r', url: 'https://a', meta: { id: 'req_1' } }]);

    const result = computeVisualDiff('', after);

    expect(result.unparseable).toBe(false);
    expect(result.entities.map(e => [e.id, e.status])).toEqual([
      ['req_1', 'added'],
      ['file:workspace', 'added'],
    ]);
  });
});

describe('ownFields', () => {
  it('drops nested entities, which are shown as their own cards', () => {
    const folder = { name: 'F', meta: { id: 'fld_1' }, children: [{ name: 'r', meta: { id: 'req_1' } }] };
    const env = { name: 'Base', data: { a: 1 }, subEnvironments: [{ name: 'Sub' }] };

    expect(ownFields(folder)).toEqual({ name: 'F', meta: { id: 'fld_1' } });
    expect(ownFields(env)).toEqual({ name: 'Base', data: { a: 1 } });
  });
});

describe('computeFieldChanges - meta', () => {
  it('reports each changed meta field under its own path, ignoring volatile ones', () => {
    const before = { meta: { id: 'req_1', modified: 1, description: 'same', isPrivate: false } };
    const after = { meta: { id: 'req_1', modified: 2, description: 'same', isPrivate: true } };

    expect(computeFieldChanges(before, after)).toEqual([
      { path: 'meta.isPrivate', label: 'Is Private', before: false, after: true },
    ]);
  });
});

describe('computeVisualDiff - file-level sections', () => {
  const mock = (extra: Record<string, unknown>) =>
    stringify({ type: 'mock.insomnia.rest/5.0', name: 'Mock', meta: { id: 'wrk_m' }, ...extra });

  it('diffs each file-level section as one whole entity', () => {
    const before = mock({ server: { url: 'https://old', useInsomniaCloud: false } });
    const after = mock({
      name: 'Mock v2',
      server: { url: 'https://new', useInsomniaCloud: false },
      testSuites: [{ name: 'suite', meta: { id: 'uts_1' }, tests: [] }],
    });

    const entities = computeVisualDiff(before, after).entities;

    expect(entities.map(e => [e.id, e.type, e.status])).toEqual([
      ['file:workspace', 'workspace', 'modified'],
      ['file:server', 'mock_server', 'modified'],
      ['file:testSuites', 'unit_tests', 'added'],
    ]);
    expect(entities[1].fieldChanges.map(c => [c.path, c.before, c.after])).toEqual([
      ['url', 'https://old', 'https://new'],
    ]);
  });

  it('does not treat a non-Insomnia YAML file as a workspace', () => {
    expect(
      computeVisualDiff(stringify({ name: 'a', rules: {} }), stringify({ name: 'b', rules: {} })).entities,
    ).toEqual([]);
  });
});

describe('diffByKey', () => {
  const userAgent = { name: 'User-Agent', value: 'insomnia/12.1.0', disabled: false };
  const customUserAgent = { name: 'User-Agent', value: '123', disabled: true };
  const accept = { name: 'Accept', value: '*/*' };
  const rows = (before: unknown[], after: unknown[]) =>
    diffByKey(before as any[], after as any[], 'name').map(({ key, status }) => `${key}: ${status}`);

  it('tells same-named items apart by their order, so a change to either one shows', () => {
    const changedFirst = { ...userAgent, disabled: true };
    const changedSecond = { ...customUserAgent, value: '456' };

    expect(rows([userAgent, customUserAgent], [changedFirst, customUserAgent])).toEqual(['User-Agent (1): modified']);
    expect(rows([userAgent, customUserAgent], [changedFirst, changedSecond])).toEqual([
      'User-Agent (1): modified',
      'User-Agent (2): modified',
    ]);
  });

  it('numbers a name repeated on only one side on both, so adding or removing the last one reads as such', () => {
    expect(rows([userAgent, accept], [userAgent, accept, customUserAgent])).toEqual(['User-Agent (2): added']);
    expect(rows([userAgent, customUserAgent], [userAgent])).toEqual(['User-Agent (2): removed']);
  });

  it('keeps the plain name for items whose name is not repeated', () => {
    const before = [userAgent, customUserAgent, accept];
    expect(rows(before, [userAgent, customUserAgent, { ...accept, value: 'a' }])).toEqual(['Accept: modified']);
  });
});

describe('getBaseEnvironmentId', () => {
  it('finds the base environment, not one of its sub-environments', () => {
    const withEnvironments = stringify({
      type: 'collection.insomnia.rest/5.0',
      meta: { id: 'wrk_1' },
      environments: {
        name: 'Base Environment',
        meta: { id: 'env_base' },
        subEnvironments: [{ meta: { id: 'env_sub' } }],
      },
    });

    expect(getBaseEnvironmentId(withEnvironments)).toBe('env_base');
  });

  it('is undefined for a file without environments, an empty side or content that does not parse', () => {
    expect(getBaseEnvironmentId(file([]))).toBeUndefined();
    expect(getBaseEnvironmentId('')).toBeUndefined();
    expect(getBaseEnvironmentId('name: [\n')).toBeUndefined();
  });
});
