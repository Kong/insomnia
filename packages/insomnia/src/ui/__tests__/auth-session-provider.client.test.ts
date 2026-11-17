import { describe, expect, it } from 'vitest';

import { toUint8Array } from '../auth-session-provider.client';

describe('auth-session-provider.client', () => {
  it('toUint8Array accepts Uint8Array, arrays, and buffer-like IPC payloads', () => {
    expect(Array.from(toUint8Array(new Uint8Array([9, 8])))).toEqual([9, 8]);
    expect(Array.from(toUint8Array([7, 6]))).toEqual([7, 6]);
    expect(Array.from(toUint8Array({ data: [5, 4] }))).toEqual([5, 4]);
  });
});
