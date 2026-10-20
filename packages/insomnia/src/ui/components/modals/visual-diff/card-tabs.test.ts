import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { computeFieldChanges, type EntityDiff, type VisualDiffEntityType } from './diff-engine';
import type { DiffTabDef } from './diff-tabs';
import { buildGenericTabs } from './generic-entity-diff-card';
import { buildRequestTabs } from './request-diff-card';
import { buildRequestGroupTabs } from './request-group-diff-card';
import { ValueChange } from './shared';

// Monaco needs a browser; the stand-in records what the highlighted diff would have shown.
const inlineDiffEditor = vi.hoisted(() =>
  vi.fn((_props: { original: string; modified: string; language: string }) => null),
);
vi.mock('./inline-diff-editor', () => ({ InlineDiffEditor: inlineDiffEditor }));

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

// Vitest compiles JSX with the classic runtime (React.createElement) while the app's own
// modules rely on Vite's automatic runtime and never import React — expose it for rendering.
Object.assign(globalThis, { React });

// Also renders every tab's content, so a section that crashes while rendering fails the test
// (a render-time error takes the whole commit modal down with it).
const summary = (tabs: DiffTabDef[]) =>
  tabs.map(({ id, status, count, content }) => {
    renderToStaticMarkup(React.createElement(content));
    return { id, status, count };
  });

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

  it('shows a change to the first of two same-named params as its own row, not in the Settings catch-all', () => {
    const tags = (first: string) => [
      { name: 'tag', value: first },
      { name: 'tag', value: 'b' },
    ];
    const tabs = buildRequestTabs(
      modified('request', { ...before, parameters: tags('a') }, { ...before, parameters: tags('z') }),
    );

    expect(summary(tabs)).toEqual([{ id: 'params', status: 'modified', count: 1 }]);
    expect(renderToStaticMarkup(React.createElement(tabs[0].content))).toContain('tag (1)');
  });
});

describe('Settings catch-all for changes a tab finds nothing to show for', () => {
  const request = { name: 'r', url: 'https://a', method: 'GET', meta: { id: 'req_1' } };
  const settingsPaths = (tabs: DiffTabDef[]) => {
    const settings = tabs.find(tab => tab.id === 'settings');
    return settings ? renderToStaticMarkup(React.createElement(settings.content)) : '';
  };

  it('shows headers that were only reordered', () => {
    const headers = [
      { name: 'A', value: '1' },
      { name: 'B', value: '2' },
    ];
    const tabs = buildRequestTabs(
      modified('request', { ...request, headers }, { ...request, headers: [...headers].reverse() }),
    );

    expect(summary(tabs)).toEqual([{ id: 'settings', status: 'modified', count: 1 }]);
    expect(settingsPaths(tabs)).toContain('Headers');
  });

  it('only counts the sections of a tab that showed something', () => {
    // Query params only reordered (no rows), path params changed (one row)
    const parameters = [
      { name: 'a', value: '1' },
      { name: 'b', value: '2' },
    ];
    const before = { ...request, parameters, pathParameters: [{ name: 'id', value: '1' }] };
    const after = { ...request, parameters: [...parameters].reverse(), pathParameters: [{ name: 'id', value: '2' }] };

    const tabs = buildRequestTabs(modified('request', before, after));

    expect(summary(tabs)).toEqual([
      { id: 'params', status: 'modified', count: 1 },
      { id: 'settings', status: 'modified', count: 1 },
    ]);
  });
});

describe('buildRequestGroupTabs', () => {
  const before = {
    name: 'f',
    meta: { id: 'fld_1' },
    environment: { host: 'old', port: 80 },
    environmentPropertyOrder: { '&': ['host', 'port'] },
    children: [{ name: 'r', url: 'https://a', meta: { id: 'req_1' } }],
  };

  it("shows the folder's own sections, with environment variables compared by name", () => {
    const after = {
      ...before,
      headers: [{ name: 'X-Folder', value: '1' }],
      authentication: { type: 'bearer', token: 't' },
      scripts: { preRequest: 'console.log(1)' },
      environment: { host: 'new', port: 80, debug: true },
      environmentPropertyOrder: { '&': ['host', 'port', 'debug'] },
      meta: { id: 'fld_1', description: 'docs' },
    };

    expect(summary(buildRequestGroupTabs(modified('request_group', before, after)))).toEqual([
      { id: 'auth', status: 'added', count: undefined },
      { id: 'headers', status: 'added', count: 1 },
      { id: 'scripts', status: 'added', count: undefined },
      { id: 'environment', status: 'modified', count: 2 },
      { id: 'docs', status: 'added', count: undefined },
    ]);
  });

  it('still surfaces a variable reorder on its own', () => {
    const after = { ...before, environmentPropertyOrder: { '&': ['port', 'host'] } };

    expect(summary(buildRequestGroupTabs(modified('request_group', before, after)))).toEqual([
      { id: 'environment', status: 'modified', count: 0 },
    ]);
  });

  it('ignores changes to child requests, which have their own cards', () => {
    const after = { ...before, children: [{ ...before.children[0], url: 'https://b' }] };

    expect(buildRequestGroupTabs(modified('request_group', before, after))).toEqual([]);
  });
});

describe('buildGenericTabs', () => {
  const server = { url: 'https://mock', useInsomniaCloud: false, meta: { id: 'mock_1' } };

  it('puts every changed field except the name (shown in the header) into one tab', () => {
    const before = { type: 'collection.insomnia.rest/5.0', name: 'A', meta: { id: 'wrk_1', description: '' } };
    const after = { ...before, name: 'B', meta: { id: 'wrk_1', description: 'docs' } };

    expect(summary(buildGenericTabs(modified('workspace', before, after)))).toEqual([
      { id: 'fields', status: 'modified', count: 1 },
    ]);
  });

  it('lists every field of an added entity', () => {
    expect(summary(buildGenericTabs(added('mock_server', server)))).toEqual([
      { id: 'fields', status: 'added', count: 2 },
    ]);
  });
});

describe('ValueChange', () => {
  const render = (before: unknown, after: unknown) =>
    renderToStaticMarkup(React.createElement(ValueChange, { before, after }));

  beforeEach(() => inlineDiffEditor.mockClear());

  it('highlights the diff of a long value changed on both sides, as JSON when it holds JSON', () => {
    render('{\n  "name": "Rex"\n}', '{\n  "name": "Rex",\n  "age": 3\n}');
    render({ info: { version: '1.0.3' } }, { info: { version: '1.0.4' } });
    render('line one\nline two', 'line one\nline 2');

    expect(inlineDiffEditor.mock.calls.map(([props]) => props.language)).toEqual(['json', 'json', 'plaintext']);
    expect(inlineDiffEditor.mock.calls[1][0].modified).toContain('"version": "1.0.4"');
  });

  it('keeps short values, and values on one side only, as plain before/after blocks', () => {
    const shortMarkup = render('https://a', 'https://b');
    const addedMarkup = render(undefined, 'line one\nline two');

    expect(inlineDiffEditor).not.toHaveBeenCalled();
    expect(shortMarkup).toContain('https://b');
    expect(addedMarkup).toContain('line two');
  });
});
