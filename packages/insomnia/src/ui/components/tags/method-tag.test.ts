import type { Request } from 'insomnia-data';
import { models } from 'insomnia-data';
import { describe, expect, it } from 'vitest';

import { formatMethodName, getMethodShortHand } from './method-tag';

describe('formatMethodName', () => {
  it('shortens long method names', () => {
    expect(formatMethodName('GET')).toBe('GET');
    expect(formatMethodName('DELETE')).toBe('DEL');
    expect(formatMethodName('OPTIONS')).toBe('OPT');
    expect(formatMethodName('QUERY')).toBe('QRY');
    expect(formatMethodName('CUSTOMMETHOD')).toBe('CSTM');
  });

  it('returns an empty string when the method is missing', () => {
    expect(formatMethodName()).toBe('');
  });
});

describe('getMethodShortHand', () => {
  it('does not throw for a request without a method', () => {
    const request = { ...models.request.init(), type: models.request.type, method: undefined } as unknown as Request;
    expect(getMethodShortHand(request)).toBe('');
  });
});
