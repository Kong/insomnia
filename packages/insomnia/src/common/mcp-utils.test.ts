import { describe, expect, it } from 'vitest';

import type { McpEvent } from '~/main/mcp/types';

import {
  findAccumulatedListResult,
  findFirstMatchEventData,
  findLatestListResult,
  METHOD_INITIALIZE,
  METHOD_LIST_PROMPTS,
  METHOD_LIST_RESOURCE_TEMPLATES,
  METHOD_LIST_RESOURCES,
  METHOD_LIST_TOOLS,
} from './mcp-utils';

const BASE = { _id: 'evt', requestId: 'req_1', timestamp: 0 };

const outgoing = (method: string, id: number, cursor?: string): McpEvent =>
  ({
    ...BASE,
    type: 'message',
    direction: 'OUTGOING',
    method,
    data: { jsonrpc: '2.0', id, method, params: cursor ? { cursor } : {} },
  }) as McpEvent;

const incomingResult = (method: string, id: number, result: unknown): McpEvent =>
  ({
    ...BASE,
    type: 'message',
    direction: 'INCOMING',
    method,
    data: { jsonrpc: '2.0', id, result },
  }) as McpEvent;

const incomingErrorEvent = (id: number, title: string, message: string): McpEvent =>
  ({
    ...BASE,
    type: 'error',
    message: title,
    error: { code: -32_601, requestId: id, message },
  }) as McpEvent;

const validTool = (name: string) => ({ name, inputSchema: { type: 'object' } });

describe('findFirstMatchEventData', () => {
  it('returns undefined when no incoming event matches the method', () => {
    const events = [incomingResult(METHOD_LIST_TOOLS, 1, { tools: [] })];

    expect(findFirstMatchEventData(events, METHOD_INITIALIZE)).toBeUndefined();
  });

  it('returns the result payload of the matching incoming event', () => {
    const events = [incomingResult(METHOD_INITIALIZE, 1, { capabilities: { tools: {} } })];

    expect(findFirstMatchEventData(events, METHOD_INITIALIZE)).toEqual({ capabilities: { tools: {} } });
  });

  it('returns undefined when the matching event carries no result field', () => {
    const events: McpEvent[] = [
      { ...BASE, type: 'message', direction: 'INCOMING', method: METHOD_INITIALIZE, data: {} } as McpEvent,
    ];

    expect(findFirstMatchEventData(events, METHOD_INITIALIZE)).toBeUndefined();
  });

  it('picks the first matching event when there are multiple (latest-first ordering)', () => {
    const events = [
      incomingResult(METHOD_INITIALIZE, 2, { capabilities: { tools: {} } }),
      incomingResult(METHOD_INITIALIZE, 1, { capabilities: { resources: {} } }),
    ];

    expect(findFirstMatchEventData(events, METHOD_INITIALIZE)).toEqual({ capabilities: { tools: {} } });
  });
});

describe('findAccumulatedListResult', () => {
  // Latest-first ordering, as produced by the main process's event log.
  const latestFirst = (...chronological: McpEvent[][]) => chronological.flat().reverse();
  const page = (id: number, result: unknown, cursor?: string) => [
    outgoing(METHOD_LIST_TOOLS, id, cursor),
    incomingResult(METHOD_LIST_TOOLS, id, result),
  ];

  it('returns undefined when no page has arrived', () => {
    expect(findAccumulatedListResult([], METHOD_LIST_TOOLS)).toBeUndefined();
    expect(findAccumulatedListResult([outgoing(METHOD_LIST_TOOLS, 1)], METHOD_LIST_TOOLS)).toBeUndefined();
  });

  it('combines every page of a cursor chain and keeps the last cursor', () => {
    const events = latestFirst(
      page(1, { tools: [validTool('a')], nextCursor: 'c1' }),
      page(2, { tools: [validTool('b')], nextCursor: 'c2' }, 'c1'),
      page(3, { tools: [validTool('c')] }, 'c2'),
    );

    expect(findAccumulatedListResult(events, METHOD_LIST_TOOLS)).toEqual({
      data: { tools: [validTool('a'), validTool('b'), validTool('c')] },
    });
    expect(findAccumulatedListResult(events.slice(2), METHOD_LIST_TOOLS)?.data.nextCursor).toBe('c2');
  });

  it('starts over at the latest request without a cursor (refresh)', () => {
    const events = latestFirst(
      page(1, { tools: [validTool('a')], nextCursor: 'c1' }),
      page(2, { tools: [validTool('b')] }, 'c1'),
      page(3, { tools: [validTool('fresh')], nextCursor: 'c9' }),
    );

    expect(findAccumulatedListResult(events, METHOD_LIST_TOOLS)).toEqual({
      data: { tools: [validTool('fresh')], nextCursor: 'c9' },
    });
  });

  it('accumulates skipped-entry errors across pages with a combined count', () => {
    const events = latestFirst(
      page(1, { tools: [validTool('a'), { name: 'bad1' }], nextCursor: 'c1' }),
      page(2, { tools: [validTool('b'), { name: 'bad2' }, { name: 'bad3' }] }, 'c1'),
    );
    const outcome = findAccumulatedListResult(events, METHOD_LIST_TOOLS);

    expect(outcome?.data.tools).toEqual([validTool('a'), validTool('b')]);
    expect(outcome?.error?.title).toBe('3 entries were skipped because they do not match the MCP schema.');
    expect(outcome?.error?.entries?.map(e => e.label)).toEqual(['bad1', 'bad2', 'bad3']);
  });

  it('drops skipped-entry errors from before a refresh', () => {
    const events = latestFirst(
      page(1, { tools: [{ name: 'bad' }], nextCursor: 'c1' }),
      page(2, { tools: [validTool('fresh')] }),
    );

    expect(findAccumulatedListResult(events, METHOD_LIST_TOOLS)).toEqual({ data: { tools: [validTool('fresh')] } });
  });

  it('keeps items and the previous cursor when a Load More page fails as a whole', () => {
    const events = latestFirst(page(1, { tools: [validTool('a')], nextCursor: 'c1' }), [
      outgoing(METHOD_LIST_TOOLS, 2, 'c1'),
      incomingErrorEvent(2, 'Error', 'boom'),
    ]);
    const outcome = findAccumulatedListResult(events, METHOD_LIST_TOOLS);

    expect(outcome?.data).toEqual({ tools: [validTool('a')], nextCursor: 'c1' });
    expect(outcome?.error).toEqual({ title: 'Error: boom' });
  });

  it('clears a failed page error once the retry of the same cursor succeeds', () => {
    const events = latestFirst(
      page(1, { tools: [validTool('a')], nextCursor: 'c1' }),
      [outgoing(METHOD_LIST_TOOLS, 2, 'c1'), incomingErrorEvent(2, 'Error', 'boom')],
      page(3, { tools: [validTool('b')] }, 'c1'),
    );

    expect(findAccumulatedListResult(events, METHOD_LIST_TOOLS)).toEqual({
      data: { tools: [validTool('a'), validTool('b')] },
    });
  });

  it('ignores a page whose response has not arrived yet', () => {
    const events = latestFirst(page(1, { tools: [validTool('a')], nextCursor: 'c1' }), [
      outgoing(METHOD_LIST_TOOLS, 2, 'c1'),
    ]);

    expect(findAccumulatedListResult(events, METHOD_LIST_TOOLS)).toEqual({
      data: { tools: [validTool('a')], nextCursor: 'c1' },
    });
  });

  it('does not mix pages of different methods', () => {
    const events = latestFirst(
      page(1, { tools: [validTool('a')], nextCursor: 'c1' }),
      [outgoing(METHOD_LIST_PROMPTS, 2), incomingResult(METHOD_LIST_PROMPTS, 2, { prompts: [{ name: 'p' }] })],
      page(3, { tools: [validTool('b')] }, 'c1'),
    );

    expect(findAccumulatedListResult(events, METHOD_LIST_TOOLS)?.data.tools).toEqual([validTool('a'), validTool('b')]);
    expect(findAccumulatedListResult(events, METHOD_LIST_PROMPTS)?.data.prompts).toEqual([{ name: 'p' }]);
  });
});

describe('findLatestListResult', () => {
  it('returns undefined when there is no outgoing request for the method', () => {
    const events = [incomingResult(METHOD_LIST_TOOLS, 1, { tools: [] })];

    expect(findLatestListResult(events, METHOD_LIST_TOOLS)).toBeUndefined();
  });

  it('returns undefined while the response has not arrived yet', () => {
    const events = [outgoing(METHOD_LIST_TOOLS, 1)];

    expect(findLatestListResult(events, METHOD_LIST_TOOLS)).toBeUndefined();
  });

  it('surfaces a JSON-RPC error response as an error', () => {
    const events = [outgoing(METHOD_LIST_TOOLS, 1), incomingErrorEvent(1, 'Error', 'Method not found')];

    expect(findLatestListResult(events, METHOD_LIST_TOOLS)).toEqual({ error: { title: 'Error: Method not found' } });
  });

  it('returns the result untouched when it matches the schema', () => {
    const result = { tools: [validTool('a'), validTool('b')] };
    const events = [outgoing(METHOD_LIST_TOOLS, 1), incomingResult(METHOD_LIST_TOOLS, 1, result)];

    expect(findLatestListResult(events, METHOD_LIST_TOOLS)).toEqual({ data: result });
  });

  it('reports the whole response as invalid when the items are not an array', () => {
    const result = { tools: 'not-an-array' };
    const events = [outgoing(METHOD_LIST_TOOLS, 1), incomingResult(METHOD_LIST_TOOLS, 1, result)];

    expect(findLatestListResult(events, METHOD_LIST_TOOLS)).toEqual({
      error: { title: `The server returned a ${METHOD_LIST_TOOLS} response that does not match the MCP schema.` },
    });
  });

  it('reports the whole response as invalid when the result itself is not an object', () => {
    const events = [outgoing(METHOD_LIST_TOOLS, 1), incomingResult(METHOD_LIST_TOOLS, 1, null)];

    const outcome = findLatestListResult(events, METHOD_LIST_TOOLS);

    expect(outcome?.data).toBeUndefined();
    expect(outcome?.error?.title).toBe(
      `The server returned a ${METHOD_LIST_TOOLS} response that does not match the MCP schema.`,
    );
  });

  it('drops a single malformed entry and keeps the valid ones', () => {
    const result = { tools: [validTool('a'), { name: 'b' }] };
    const events = [outgoing(METHOD_LIST_TOOLS, 1), incomingResult(METHOD_LIST_TOOLS, 1, result)];

    const outcome = findLatestListResult(events, METHOD_LIST_TOOLS);

    expect(outcome?.data?.tools).toEqual([validTool('a')]);
    expect(outcome?.error?.title).toBe('1 entry was skipped because they do not match the MCP schema.');
    expect(outcome?.error?.entries).toHaveLength(1);
    expect(outcome?.error?.entries?.[0].label).toBe('b');
  });

  it('lists every malformed entry, not just the first', () => {
    const result = { tools: [validTool('a'), { name: 'b' }, { name: 'c' }] };
    const events = [outgoing(METHOD_LIST_TOOLS, 1), incomingResult(METHOD_LIST_TOOLS, 1, result)];

    const outcome = findLatestListResult(events, METHOD_LIST_TOOLS);

    expect(outcome?.data?.tools).toEqual([validTool('a')]);
    expect(outcome?.error?.title).toBe('2 entries were skipped because they do not match the MCP schema.');
    expect(outcome?.error?.entries?.map(entry => entry.label)).toEqual(['b', 'c']);
  });

  it('labels a malformed entry by its position when it has no identifying field', () => {
    const result = { tools: [validTool('a'), 42] };
    const events = [outgoing(METHOD_LIST_TOOLS, 1), incomingResult(METHOD_LIST_TOOLS, 1, result)];

    const outcome = findLatestListResult(events, METHOD_LIST_TOOLS);

    expect(outcome?.error?.entries?.[0]).toEqual({ label: 'index 1', reason: expect.any(String) });
  });

  it('appends a count of remaining issues when an entry fails more than one schema check', () => {
    const result = { tools: [{}] };
    const events = [outgoing(METHOD_LIST_TOOLS, 1), incomingResult(METHOD_LIST_TOOLS, 1, result)];

    const outcome = findLatestListResult(events, METHOD_LIST_TOOLS);

    expect(outcome?.error?.entries?.[0].reason).toMatch(/\(And \d+ more\)$/);
  });

  it('reports an error when every entry is valid but another envelope field fails the schema', () => {
    const result = { tools: [], nextCursor: 123 };
    const events = [outgoing(METHOD_LIST_TOOLS, 1), incomingResult(METHOD_LIST_TOOLS, 1, result)];

    const outcome = findLatestListResult(events, METHOD_LIST_TOOLS);

    expect(outcome?.data).toBeUndefined();
    expect(outcome?.error?.title).toBe(
      `The server returned a ${METHOD_LIST_TOOLS} response that does not match the MCP schema.`,
    );
  });

  it('passes the result through untouched for methods without a configured schema', () => {
    const result = { anything: 'goes' };
    const events = [outgoing('custom/method', 1), incomingResult('custom/method', 1, result)];

    expect(findLatestListResult(events, 'custom/method')).toEqual({ data: result });
  });

  it('correlates the response using the request id, not just the method', () => {
    const staleResult = { tools: [validTool('stale')] };
    const freshResult = { tools: [validTool('fresh')] };
    // Latest-first ordering, as produced by the main process's event log.
    const events = [
      outgoing(METHOD_LIST_TOOLS, 2),
      incomingResult(METHOD_LIST_TOOLS, 2, freshResult),
      outgoing(METHOD_LIST_TOOLS, 1),
      incomingResult(METHOD_LIST_TOOLS, 1, staleResult),
    ];

    expect(findLatestListResult(events, METHOD_LIST_TOOLS)).toEqual({ data: freshResult });
  });

  describe.each([
    {
      method: METHOD_LIST_RESOURCES,
      itemsKey: 'resources',
      valid: { name: 'a', uri: 'file:///a' },
      malformed: { uri: 'file:///b' },
    },
    {
      method: METHOD_LIST_RESOURCE_TEMPLATES,
      itemsKey: 'resourceTemplates',
      valid: { name: 'a', uriTemplate: 'file:///{id}' },
      malformed: { uriTemplate: 'file:///{id}' },
    },
    {
      method: METHOD_LIST_PROMPTS,
      itemsKey: 'prompts',
      valid: { name: 'a' },
      malformed: {},
    },
  ])('$method', ({ method, itemsKey, valid, malformed }) => {
    it('accepts a fully valid list', () => {
      const result = { [itemsKey]: [valid] };
      const events = [outgoing(method, 1), incomingResult(method, 1, result)];

      expect(findLatestListResult(events, method)).toEqual({ data: result });
    });

    it('drops malformed entries while keeping the valid ones', () => {
      const result = { [itemsKey]: [valid, malformed] };
      const events = [outgoing(method, 1), incomingResult(method, 1, result)];

      const outcome = findLatestListResult(events, method);

      expect(outcome?.data?.[itemsKey]).toEqual([valid]);
      expect(outcome?.error?.entries).toHaveLength(1);
    });
  });
});
