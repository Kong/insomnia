// @flow

import callCache from '../call-cache';

describe('call-cache', () => {
  beforeEach(() => callCache.reset());

  it('should set, get and update a call in the cache', () => {
    const id1 = 'abc';
    const id2 = 'def';
    const val1 = { a: true };
    const val2 = { b: false };

    callCache.set(id1, val1);
    callCache.set(id2, val2);

    expect(callCache.get(id1)).toBe(val1);
    expect(callCache.get(id2)).toBe(val2);

    const updatedVal1 = { b: false };
    callCache.set(id1, updatedVal1);
    expect(callCache.get(id1)).toBe(updatedVal1);
  });

  it('should log to console if id not found', () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const call = callCache.get('abc');

    expect(consoleLogSpy).toHaveBeenCalledWith(`[gRPC] client call for req=abc not found`);
    expect(call).toBe(undefined);
  });

  it('should reset', () => {
    const id1 = 'abc';
    const id2 = 'abc';
    const val = { a: true };
    callCache.set(id1, val);
    callCache.set(id2, val);

    expect(callCache.get(id1)).toBe(val);
    expect(callCache.get(id2)).toBe(val);
    callCache.reset();
    expect(callCache.get(id1)).toBe(undefined);
    expect(callCache.get(id2)).toBe(undefined);
  });

  it('should clear and close channel', () => {
    const id = 'abc';
    const channel = { close: jest.fn() };
    const call = { call: { call: { channel } } };

    callCache.set(id, call);
    callCache.clear(id);

    expect(callCache.get(id)).toBe(undefined);
    expect(channel.close).toHaveBeenCalledTimes(1);
  });

  it('should clear and log to console if channel not found', () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const id = 'abc';
    const call = {};

    callCache.set(id, call);
    callCache.clear(id);

    expect(callCache.get(id)).toBe(undefined);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `[gRPC] failed to close channel for req=abc because it was not found`,
    );
  });
});
