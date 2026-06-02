import { describe, expect, it } from 'vitest';

import { base64ToUtf8, bytesToBase64, utf8ToBase64 } from './utf8-bytes';

describe('utf8 byte helpers', () => {
  it('roundtrips UTF-8 strings through base64', () => {
    const value = 'caf\u00E9 \u2603';

    expect(base64ToUtf8(utf8ToBase64(value))).toBe(value);
  });

  it('encodes arbitrary bytes to base64', () => {
    expect(bytesToBase64(new Uint8Array([0, 65, 127, 128, 159, 255]))).toBe('AEF/gJ//');
  });

  it('encodes byte arrays larger than one chunk', () => {
    const bytes = new Uint8Array(0x90_00);
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = index % 256;
    }

    const decoded = Uint8Array.from(atob(bytesToBase64(bytes)), c => c.codePointAt(0) ?? 0);

    expect(decoded).toEqual(bytes);
  });
});
