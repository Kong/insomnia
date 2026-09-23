import { describe, expect, it } from 'vitest';

import type { McpEvent } from '~/main/mcp/types';

import {
  findFirstMatchEventData,
  findLatestListResult,
  METHOD_INITIALIZE,
  METHOD_LIST_PROMPTS,
  METHOD_LIST_RESOURCE_TEMPLATES,
  METHOD_LIST_RESOURCES,
  METHOD_LIST_TOOLS,
} from './mcp-utils';

const BASE = { _id: 'evt', requestId: 'req_1', timestamp: 0 };

const outgoing = (method: string, id: number): McpEvent =>
  ({
    ...BASE,
    type: 'message',
    direction: 'OUTGOING',
    method,
    data: { jsonrpc: '2.0', id, method, params: {} },
  }) as McpEvent;

const incomingResult = (method: string, id: number, result: unknown): McpEvent =>
  ({
    ...BASE,
    type: 'message',
    direction: 'INCOMING',
    method,
    data: { jsonrpc: '2.0', id, result },
  }) as McpEvent;

const incomingErrorEvent = (id: number, message: string): McpEvent =>
  ({
    ...BASE,
    type: 'error',
    message,
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
    const events = [outgoing(METHOD_LIST_TOOLS, 1), incomingErrorEvent(1, 'Method not found')];

    expect(findLatestListResult(events, METHOD_LIST_TOOLS)).toEqual({ error: { title: 'Method not found' } });
  });

  it('falls back to a default message when the error event carries none', () => {
    const events = [outgoing(METHOD_LIST_TOOLS, 1), incomingErrorEvent(1, '')];

    expect(findLatestListResult(events, METHOD_LIST_TOOLS)).toEqual({
      error: { title: `MCP server returned an error for ${METHOD_LIST_TOOLS}` },
    });
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
      error: { title: `Server returns ${METHOD_LIST_TOOLS} response that does not meet MCP schema` },
    });
  });

  it('reports the whole response as invalid when the result itself is not an object', () => {
    const events = [outgoing(METHOD_LIST_TOOLS, 1), incomingResult(METHOD_LIST_TOOLS, 1, null)];

    const outcome = findLatestListResult(events, METHOD_LIST_TOOLS);

    expect(outcome?.data).toBeUndefined();
    expect(outcome?.error?.title).toBe(`Server returns ${METHOD_LIST_TOOLS} response that does not meet MCP schema`);
  });

  it('drops a single malformed entry and keeps the valid ones', () => {
    const result = { tools: [validTool('a'), { name: 'b' }] };
    const events = [outgoing(METHOD_LIST_TOOLS, 1), incomingResult(METHOD_LIST_TOOLS, 1, result)];

    const outcome = findLatestListResult(events, METHOD_LIST_TOOLS);

    expect(outcome?.data?.tools).toEqual([validTool('a')]);
    expect(outcome?.error?.title).toBe('Drop 1 entry that fails the MCP schema.');
    expect(outcome?.error?.entries).toHaveLength(1);
    expect(outcome?.error?.entries?.[0].label).toBe('b');
  });

  it('lists every malformed entry, not just the first', () => {
    const result = { tools: [validTool('a'), { name: 'b' }, { name: 'c' }] };
    const events = [outgoing(METHOD_LIST_TOOLS, 1), incomingResult(METHOD_LIST_TOOLS, 1, result)];

    const outcome = findLatestListResult(events, METHOD_LIST_TOOLS);

    expect(outcome?.data?.tools).toEqual([validTool('a')]);
    expect(outcome?.error?.title).toBe('Drop 2 entries that fail the MCP schema.');
    expect(outcome?.error?.entries?.map(entry => entry.label)).toEqual(['b', 'c']);
  });

  it('labels a malformed entry by its position when it has no identifying field', () => {
    const result = { tools: [validTool('a'), 42] };
    const events = [outgoing(METHOD_LIST_TOOLS, 1), incomingResult(METHOD_LIST_TOOLS, 1, result)];

    const outcome = findLatestListResult(events, METHOD_LIST_TOOLS);

    expect(outcome?.error?.entries?.[0]).toEqual({ label: 'index 1', reason: expect.any(String) });
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
      expect(outcome?.error?.title).toBe('Drop 1 entry that fails the MCP schema.');
      expect(outcome?.error?.entries).toHaveLength(1);
    });
  });
});
