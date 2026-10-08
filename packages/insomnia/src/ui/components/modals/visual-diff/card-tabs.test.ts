import { describe, expect, it } from 'vitest';

import { computeFieldChanges, type EntityDiff, type VisualDiffEntityType } from './diff-engine';
import type { DiffTabDef } from './diff-tabs';
import { buildRequestTabs } from './request-diff-card';

function modified(type: VisualDiffEntityType, before: any, after: any): EntityDiff {
  return {
    id: before.meta.id,
    type,
    status: 'modified',
    name: after.name,
    before,
    after,
    fieldChanges: computeFieldChanges(before, after),
  };
}

function added(type: VisualDiffEntityType, after: any): EntityDiff {
  return { id: after.meta.id, type, status: 'added', name: after.name, before: undefined, after, fieldChanges: [] };
}

const summary = (tabs: DiffTabDef[]) => tabs.map(({ id, status, count }) => ({ id, status, count }));

describe('buildRequestTabs', () => {
  const before = {
    name: 'r',
    url: 'https://a',
    method: 'GET',
    meta: { id: 'req_1', description: '' },
    headers: [{ name: 'Accept', value: '*/*' }],
    parameters: [{ name: 'q', value: '1' }],
    settings: { encodeUrl: true },
  };

  it('shows only changed sections, in editor order, with a Settings catch-all for the rest', () => {
    const after = {
      ...before,
      headers: [
        { name: 'Accept', value: '*/*' },
        { name: 'X-New', value: '1' },
      ],
      parameters: [],
      body: { mimeType: 'application/json', text: '{}' },
      authentication: { type: 'bearer', token: 't' },
      scripts: { preRequest: 'console.log(1)' },
      meta: { id: 'req_1', description: 'docs' },
      settings: { encodeUrl: false },
    };

    expect(summary(buildRequestTabs(modified('request', before, after)))).toEqual([
      { id: 'params', status: 'removed', count: 1 },
      { id: 'body', status: 'added', count: undefined },
      { id: 'auth', status: 'added', count: undefined },
      { id: 'headers', status: 'added', count: 1 },
      { id: 'scripts', status: 'added', count: undefined },
      { id: 'docs', status: 'added', count: undefined },
      { id: 'settings', status: 'modified', count: 1 },
    ]);
  });

  it('has no tabs when only header-row fields (name/url/method) changed', () => {
    const after = { ...before, name: 'renamed', url: 'https://b', method: 'POST' };

    expect(buildRequestTabs(modified('request', before, after))).toEqual([]);
  });

  it('marks every populated section as added for a new request', () => {
    expect(summary(buildRequestTabs(added('request', before)))).toEqual([
      { id: 'params', status: 'added', count: 1 },
      { id: 'headers', status: 'added', count: 1 },
    ]);
  });
});
