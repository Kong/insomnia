import { describe, expect, it } from 'vitest';

import { deconstructQueryStringToParams } from './querystring';

describe('querystring', () => {
  describe('deconstructToParams()', () => {
    it('builds from params', () => {
      const str = deconstructQueryStringToParams('foo=bar%3F%3F&hello&hi%20there=bar%3F%3F&=&=val');

      expect(str).toEqual([
        { name: 'foo', value: 'bar??' },
        { name: 'hello', value: '' },
        { name: 'hi there', value: 'bar??' },
      ]);
    });
    it('builds from params with =', () => {
      const str = deconstructQueryStringToParams('foo=bar&1=2=3=4&hi');

      expect(str).toEqual([
        { name: 'foo', value: 'bar' },
        { name: '1', value: '2=3=4' },
        { name: 'hi', value: '' },
      ]);
    });

    it('builds from params not strict', () => {
      const str = deconstructQueryStringToParams('foo=bar%3F%3F&hello&hi%20there=bar%3F%3F&=&=val', false);

      expect(str).toEqual([
        { name: 'foo', value: 'bar??' },
        { name: 'hello', value: '' },
        { name: 'hi there', value: 'bar??' },
        { name: '', value: '' },
        { name: '', value: 'val' },
      ]);
    });

    it('builds from params with strictNullHandle', () => {
      const str = deconstructQueryStringToParams('foo=bar&foo1&foo2=', true, { strictNullHandling: true });

      expect(str).toEqual([
        { name: 'foo', value: 'bar' },
        { name: 'foo1', value: null },
        { name: 'foo2', value: '' },
      ]);
    });
  });
});
