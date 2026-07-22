import { describe, expect, it } from 'vitest';

import { PortRpc } from './port-rpc';

function createMockTransport() {
  let handler: ((data: any) => void) | null = null;
  const sent: unknown[] = [];
  return {
    send: (msg: unknown) => sent.push(msg),
    onMessage: (h: (data: any) => void) => { handler = h; },
    simulateResponse: (data: any) => handler?.(data),
    sent,
  };
}

describe('PortRpc', () => {
  it('invoke rejects when not attached', async () => {
    const rpc = new PortRpc();
    await expect(rpc.invoke('database', 'find')).rejects.toThrow('data port not available');
  });

  it('invoke sends a message and resolves on ok response', async () => {
    const rpc = new PortRpc();
    const transport = createMockTransport();
    rpc.attach(transport.send, transport.onMessage);

    const promise = rpc.invoke('database', 'find', { type: 'Request' });

    expect(transport.sent).toHaveLength(1);
    const msg = transport.sent[0] as any;
    expect(msg.type).toBe('invoke');
    expect(msg.namespace).toBe('database');
    expect(msg.method).toBe('find');
    expect(msg.args).toEqual([{ type: 'Request' }]);

    transport.simulateResponse({ id: msg.id, ok: true, result: [{ _id: '1' }] });
    await expect(promise).resolves.toEqual([{ _id: '1' }]);
  });

  it('invoke rejects on error response with deserialized error', async () => {
    const rpc = new PortRpc();
    const transport = createMockTransport();
    rpc.attach(transport.send, transport.onMessage);

    const promise = rpc.invoke('services', 'request.getById', 'req_1');

    const msg = transport.sent[0] as any;
    transport.simulateResponse({
      id: msg.id,
      ok: false,
      error: { name: 'TypeError', message: 'not found', stack: '' },
    });

    await expect(promise).rejects.toThrow('not found');
  });

  it('invalidate rejects all pending requests', async () => {
    const rpc = new PortRpc();
    const transport = createMockTransport();
    rpc.attach(transport.send, transport.onMessage);

    const p1 = rpc.invoke('database', 'find');
    const p2 = rpc.invoke('database', 'count');

    rpc.invalidate('restart');

    await expect(p1).rejects.toThrow('restart');
    await expect(p2).rejects.toThrow('restart');
  });

  it('invoke rejects after invalidate', async () => {
    const rpc = new PortRpc();
    const transport = createMockTransport();
    rpc.attach(transport.send, transport.onMessage);
    rpc.invalidate('gone');

    await expect(rpc.invoke('database', 'find')).rejects.toThrow('data port not available');
  });

  it('ignores responses for unknown request ids', () => {
    const rpc = new PortRpc();
    const transport = createMockTransport();
    rpc.attach(transport.send, transport.onMessage);

    // Should not throw
    transport.simulateResponse({ id: 'unknown-id', ok: true, result: null });
  });

  it('serializes Buffer in args and deserializes Buffer in response', async () => {
    const rpc = new PortRpc();
    const transport = createMockTransport();
    rpc.attach(transport.send, transport.onMessage);

    const buf = Buffer.from('hello');
    const promise = rpc.invoke('database', 'upsert', { _id: 'req_1', body: buf });

    const msg = transport.sent[0] as any;
    expect(msg.args[0].body.__buffer__).toBe(true);
    expect(msg.args[0].body.data).toBeInstanceOf(Uint8Array);

    transport.simulateResponse({
      id: msg.id,
      ok: true,
      result: { __buffer__: true, data: new Uint8Array([1, 2, 3]) },
    });

    const result = await promise;
    expect(Buffer.isBuffer(result)).toBe(true);
    expect((result as Buffer).toString()).toBe('\u0001\u0002\u0003');
  });
});
