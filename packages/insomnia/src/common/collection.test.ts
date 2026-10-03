import { models } from 'insomnia-data';
import { describe, expect, it } from 'vitest';

import type { Child } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';

import { filterCollection } from './collection';

const makeChild = (doc: Record<string, unknown>): Child =>
  ({
    doc: { type: models.request.type, ...doc },
    children: [],
    collapsed: false,
    hidden: false,
    pinned: false,
    level: 0,
    ancestors: [],
  }) as unknown as Child;

describe('filterCollection()', () => {
  it('hides docs that do not match the filter', () => {
    const children = [makeChild({ _id: 'req_1', name: 'Get users', url: 'https://api.example.com' })];

    expect(filterCollection(children, 'users').map(child => child.hidden)).toEqual([false]);
    expect(filterCollection(children, 'missing').map(child => child.hidden)).toEqual([true]);
  });

  // Docs are read straight off disk (NeDB) and can carry non-string values, e.g. a folder
  // `description` object imported from Postman. A filter must not take the sidebar down with it.
  it('tolerates non-string searchable fields on a doc', () => {
    const children = [
      makeChild({ _id: 'req_1', name: 42, description: { content: 'markdown', type: 'text/markdown' }, url: 8080 }),
      makeChild({ _id: 'req_2', name: 'Get users', url: 'https://api.example.com' }),
    ];

    const filtered = filterCollection(children, 'users');

    expect(filtered.map(child => child.hidden)).toEqual([true, false]);
  });
});
