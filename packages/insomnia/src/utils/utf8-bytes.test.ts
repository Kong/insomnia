import { describe, expect, it } from 'vitest';

import { base64ToUtf8, bytesToBase64, latin1BytesFromString, utf8ByteLength, utf8ToBase64 } from './utf8-bytes';

describe('utf8 byte helpers', () => {
  it('roundtrips UTF-8 strings through base64', () => {
    const value = 'caf\u00E9 \u2603';

    expect(base64ToUtf8(utf8ToBase64(value))).toBe(value);
  });

  it('encodes arbitrary bytes to base64', () => {
    expect(bytesToBase64(new Uint8Array([0, 65, 127, 128, 159, 255]))).toBe('AEF/gJ//');
  });

  it('counts utf8 byte length', () => {
    expect(utf8ByteLength('hello')).toBe(5);
    expect(utf8ByteLength('é')).toBe(2);
  });

  it('encodes latin1 bytes', () => {
    expect(Array.from(latin1BytesFromString('password-é'))).toEqual([
      0x70, 0x61, 0x73, 0x73, 0x77, 0x6f, 0x72, 0x64, 0x2d, 0xe9,
    ]);
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
