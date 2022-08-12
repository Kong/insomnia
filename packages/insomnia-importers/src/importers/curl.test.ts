import { describe, expect, it } from '@jest/globals';
import { quote } from 'shell-quote';

import { convert } from './curl';

describe('curl', () => {
  const url = 'http://example.com';
  const method = '-X POST';
  const mimeType = 'application/x-www-form-urlencoded';
  const header = `-H 'Content-Type: ${mimeType}'`;

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
      { input: '%3d', expected: '=' },
      { input: '"', expected: '"' },
    ])('encodes %p correctly', ({ input, expected }: { input: string; expected: string }) => {
      const quoted = quote([input]);
      const rawData = `curl ${method} ${url} ${header} --data ${quoted} --data-urlencode ${quoted}`;

      expect(convert(rawData)).toMatchObject([{
        body: {
          params: [
            { name: expected, value: '' },
            { name: input, value: '' },
          ],
        },
      }]);
    });

    it('handles & correctly', () => {
      const rawData = `curl ${method} ${url} ${header} --data a=1\\&b=2 --data-urlencode c=3\\&d=4`;
      expect(convert(rawData)).toMatchObject([{
        body: {
          params: [
            { name: 'a', value: '1' },
            { name: 'b', value: '2' },
            { name: 'c=3&d=4', value: '' },
          ],
        },
      }]);
    });

    it('throws on invalid url encoding', () => {
      const rawData = `curl ${method} ${url} ${header} --data %`;
      expect(() => convert(rawData)).toThrow('URI malformed');
    });
  });
});
