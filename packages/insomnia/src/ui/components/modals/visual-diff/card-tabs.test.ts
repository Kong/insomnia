import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { computeFieldChanges, type EntityDiff, type VisualDiffEntityType } from './diff-engine';
import type { DiffTabDef } from './diff-tabs';
import { buildGrpcTabs } from './grpc-diff-card';
import { buildRequestTabs } from './request-diff-card';
import { buildSocketIOTabs } from './socket-io-diff-card';
import { buildWebSocketTabs } from './websocket-diff-card';

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
});

describe('buildWebSocketTabs', () => {
  it('maps params/auth/headers/docs to their tabs and connection settings to the Settings catch-all', () => {
    const before = { name: 'ws', url: 'wss://a', meta: { id: 'ws-req_1' }, settings: { encodeUrl: true } };
    const after = {
      ...before,
      parameters: [{ name: 'room', value: '1' }],
      headers: [{ name: 'X-Token', value: 't' }],
      authentication: { type: 'basic', username: 'u', password: 'p' },
      meta: { id: 'ws-req_1', description: 'docs' },
      settings: { encodeUrl: false },
    };

    expect(summary(buildWebSocketTabs(modified('websocket_request', before, after)))).toEqual([
      { id: 'params', status: 'added', count: 1 },
      { id: 'auth', status: 'added', count: undefined },
      { id: 'headers', status: 'added', count: 1 },
      { id: 'docs', status: 'added', count: undefined },
      { id: 'settings', status: 'modified', count: 1 },
    ]);
  });
});

describe('buildSocketIOTabs', () => {
  const listener = { id: 'el_1', eventName: 'message', desc: '', isOpen: false };
  const before = { name: 'io', url: 'http://a', meta: { id: 'socketio-req_1' }, eventListeners: [listener] };

  it('matches event listeners by id, so renaming one is a modification rather than remove + add', () => {
    const after = { ...before, eventListeners: [{ ...listener, eventName: 'chat' }] };

    expect(summary(buildSocketIOTabs(modified('socketio_request', before, after)))).toEqual([
      { id: 'events', status: 'modified', count: 1 },
    ]);
  });

  it('counts added and removed listeners together', () => {
    const after = { ...before, eventListeners: [{ id: 'el_2', eventName: 'chat', desc: '', isOpen: true }] };

    expect(summary(buildSocketIOTabs(modified('socketio_request', before, after)))).toEqual([
      { id: 'events', status: 'modified', count: 2 },
    ]);
  });
});

describe('buildGrpcTabs', () => {
  const before = {
    name: 'g',
    url: 'localhost:50051',
    meta: { id: 'greq_1' },
    protoMethodName: '/hello.Greeter/SayHello',
    body: { text: '{}' },
    reflectionApi: { enabled: false, url: '', apiKey: '', module: '' },
  };

  it('shows method, message, metadata, reflection and docs changes in their own tabs', () => {
    const after = {
      ...before,
      protoMethodName: '/hello.Greeter/SayGoodbye',
      body: { text: '{ "name": "x" }' },
      metadata: [{ name: 'authorization', value: 'Bearer t' }],
      reflectionApi: { ...before.reflectionApi, enabled: true },
      meta: { id: 'greq_1', description: 'docs' },
    };

    expect(summary(buildGrpcTabs(modified('grpc_request', before, after)))).toEqual([
      { id: 'method', status: 'modified', count: undefined },
      { id: 'message', status: 'modified', count: undefined },
      { id: 'headers', status: 'added', count: 1 },
      { id: 'reflection', status: 'modified', count: 1 },
      { id: 'docs', status: 'added', count: undefined },
    ]);
  });
});
