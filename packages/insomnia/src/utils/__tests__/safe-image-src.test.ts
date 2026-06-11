import { describe, expect, it } from 'vitest';

import { safeImageSrc } from '../safe-image-src';

describe('safeImageSrc', () => {
  it('allows absolute https URLs', () => {
    expect(safeImageSrc('https://example.com/icon.png')).toBe('https://example.com/icon.png');
  });

  it('blocks http URLs', () => {
    expect(safeImageSrc('http://example.com/icon.png')).toBeUndefined();
  });

  it('blocks javascript:, data: and file: schemes', () => {
    expect(safeImageSrc('javascript:alert(1)')).toBeUndefined();
    expect(safeImageSrc('data:image/png;base64,AAAA')).toBeUndefined();
    expect(safeImageSrc('file:///etc/passwd')).toBeUndefined();
  });

  it('returns undefined for missing or unparseable input', () => {
    expect(safeImageSrc()).toBeUndefined();
    expect(safeImageSrc('')).toBeUndefined();
    expect(safeImageSrc('not a url')).toBeUndefined();
    expect(safeImageSrc('/relative/path.png')).toBeUndefined();
  });
});
