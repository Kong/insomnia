import { describe, expect, it } from '@jest/globals';
import { quote } from 'shell-quote';

import { convert } from './curl';

describe('curl', () => {
  describe('encoding', () => {
    it.each([
      { input: ' ', expected: ' ' },
      { input: 'a=', expected: 'a' }, // using `a` before `=` to disambiguate shell parameters
      { input: '<', expected: '<' },
      { input: '>', expected: '>' },
      { input: '[', expected: '[' },
      { input: ']', expected: ']' },
      { input: '{', expected: '{' },
      { input: '}', expected: '}' },
      { input: '|', expected: '|' },
      { input: '^', expected: '^' },
      { input: '%', expected: '%' },
      { input: '"', expected: '"' },
    ])('encodes %p correctly', ({ input, expected }: { input: string; expected: string }) => {
      const url = 'http://example.com';
      const method = '-X POST';
      const mimeType = 'application/x-www-form-urlencoded';
      const header = `-H 'Content-Type: ${mimeType}'`;
      const quoted = quote([input]);
      const rawData = `curl ${method} ${url} ${header} --data ${quoted} --data-urlencode ${quoted}`;

      expect(convert(rawData)).toMatchObject([{
        body: {
          params: [
            { name: expected, value: '' },
            { name: expected, value: '' },
          ],
        },
      }]);
    });
  });
});
