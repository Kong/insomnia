import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';

import { computeFieldChanges, computeVisualDiff, ownFields } from './diff-engine';

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
    expect(result.entities.map(e => [e.id, e.status])).toEqual([['req_1', 'added']]);
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
