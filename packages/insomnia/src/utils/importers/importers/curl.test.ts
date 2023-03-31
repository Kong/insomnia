import { describe, expect, it } from '@jest/globals';
import { quote } from 'shell-quote';

import { Parameter } from '../entities';
import { convert } from './curl';

describe('curl', () => {
  describe('cURL --data flags', () => {
    it.each([
      // -d
      { flag: '-d', inputs: ['key=value'], expected: [{ name: 'key', value: 'value' }] },
      { flag: '-d', inputs: ['value'], expected: [{ name: '', value: 'value' }] },
      { flag: '-d', inputs: ['@filename'], expected: [{ name: '', fileName: 'filename', type: 'file' }] },
      {
        flag: '-d',
        inputs: ['first=1', 'second=2', 'third'],
        expected: [{ name: 'first', value: '1' }, {
          name: 'second',
          value: '2',
        }, { name: '', value: 'third' }],
      },
      {
        flag: '-d',
        inputs: ['first=1&second=2'],
        expected: [{ name: 'first', value: '1' }, { name: 'second', value: '2' }],
      },
      { flag: '-d', inputs: ['%3D'], expected: [{ name: '', value: '=' }] },
      { flag: '--d', inputs: ['%3D=%3D'], expected: [{ name: '=', value: '=' }] },

      // --data
      { flag: '--data', inputs: ['key=value'], expected: [{ name: 'key', value: 'value' }] },
      { flag: '--data', inputs: ['value'], expected: [{ name: '', value: 'value' }] },
      { flag: '--data', inputs: ['@filename'], expected: [{ name: '', fileName: 'filename' }] },
      {
        flag: '--data',
        inputs: ['first=1', 'second=2', 'third'],
        expected: [{ name: 'first', value: '1' }, {
          name: 'second',
          value: '2',
        }, { name: '', value: 'third' }],
      },
      {
        flag: '--data',
        inputs: ['first=1&second=2'],
        expected: [{ name: 'first', value: '1' }, { name: 'second', value: '2' }],
      },
      { flag: '--data', inputs: ['%3D'], expected: [{ name: '', value: '=' }] },
      { flag: '--data', inputs: ['%3D=%3D'], expected: [{ name: '=', value: '=' }] },

      // --data-ascii
      { flag: '--data-ascii', inputs: ['key=value'], expected: [{ name: 'key', value: 'value' }] },
      { flag: '--data-ascii', inputs: ['value'], expected: [{ name: '', value: 'value' }] },
      { flag: '--data-ascii', inputs: ['@filename'], expected: [{ name: '', fileName: 'filename', type: 'file' }] },
      {
        flag: '--data-ascii',
        inputs: ['first=1', 'second=2', 'third'],
        expected: [{ name: 'first', value: '1' }, {
          name: 'second',
          value: '2',
        }, { name: '', value: 'third' }],
      },
      {
        flag: '--data-ascii',
        inputs: ['first=1&second=2'],
        expected: [{ name: 'first', value: '1' }, { name: 'second', value: '2' }],
      },

      // --data-binary
      { flag: '--data-binary', inputs: ['key=value'], expected: [{ name: 'key', value: 'value' }] },
      { flag: '--data-binary', inputs: ['value'], expected: [{ name: '', value: 'value' }] },
      { flag: '--data-binary', inputs: ['@filename'], expected: [{ name: '', fileName: 'filename', type: 'file' }] },
      {
        flag: '--data-binary',
        inputs: ['first=1', 'second=2', 'third'],
        expected: [{ name: 'first', value: '1' }, {
          name: 'second',
          value: '2',
        }, { name: '', value: 'third' }],
      },
      {
        flag: '--data-binary',
        inputs: ['first=1&second=2'],
        expected: [{ name: 'first', value: '1' }, { name: 'second', value: '2' }],
      },

      // --data-raw
      { flag: '--data-raw', inputs: ['@filename'], expected: [{ name: '', value: '@filename' }] },
      { flag: '--data-raw', inputs: ['key=value'], expected: [{ name: 'key', value: 'value' }] },
      {
        flag: '--data-raw',
        inputs: ['first=1', 'second=2', 'third'],
        expected: [{ name: 'first', value: '1' }, {
          name: 'second',
          value: '2',
        }, { name: '', value: 'third' }],
      },
      {
        flag: '--data-raw',
        inputs: ['first=1&second=2'],
        expected: [{ name: 'first', value: '1' }, { name: 'second', value: '2' }],
      },

      // --data-urlencode
      { flag: '--data-urlencode', inputs: ['key=value'], expected: [{ name: 'key', value: 'value' }] },
      {
        flag: '--data-urlencode',
        inputs: ['key@filename'],
        expected: [{ name: 'key', fileName: 'filename', type: 'file' }],
      },
      {
        flag: '--data-urlencode',
        inputs: ['first=1', 'second=2', 'third'],
        expected: [{ name: 'first', value: '1' }, {
          name: 'second',
          value: '2',
        }, { name: '', value: 'third' }],
      },
      {
        flag: '--data-urlencode',
        inputs: ['first=1&second=2'],
        expected: [{ name: 'first', value: '1' }, { name: 'second', value: '2' }],
      },
      { flag: '--data-urlencode', inputs: ['=value'], expected: [{ name: '', value: 'value' }] },

      // --data-urlencode URI encoding
      { flag: '--data-urlencode', inputs: ['a='], expected: [{ name: '', value: 'a=' }] },
      { flag: '--data-urlencode', inputs: [' '], expected: [{ name: '', value: ' ' }] },
      { flag: '--data-urlencode', inputs: ['<'], expected: [{ name: '', value: '<' }] },
      { flag: '--data-urlencode', inputs: ['>'], expected: [{ name: '', value: '>' }] },
      { flag: '--data-urlencode', inputs: ['?'], expected: [{ name: '', value: '?' }] },
      { flag: '--data-urlencode', inputs: ['['], expected: [{ name: '', value: '[' }] },
      { flag: '--data-urlencode', inputs: [']'], expected: [{ name: '', value: ']' }] },
      { flag: '--data-urlencode', inputs: ['|'], expected: [{ name: '', value: '|' }] },
      { flag: '--data-urlencode', inputs: ['^'], expected: [{ name: '', value: '^' }] },
      { flag: '--data-urlencode', inputs: ['"'], expected: [{ name: '', value: '"' }] },
      { flag: '--data-urlencode', inputs: ['='], expected: [{ name: '', value: '=' }] },
      { flag: '--data-urlencode', inputs: ['%3D'], expected: [{ name: '', value: '%3D' }] },
    ])('handles %p correctly', async ({
      flag,
      inputs,
      expected,
    }: { flag: string; inputs: string[]; expected: Parameter[] }) => {
      const flaggedInputs = inputs.map(input => `${flag} ${quote([input])}`).join(' ');
      const rawData = `curl -X POST https://example.com 
      -H 'Content-Type: application/x-www-form-urlencoded'
      ${flaggedInputs}
      `;

      expect(convert(rawData)).toMatchObject([{
        body: {
          params: expected,
        },
      }]);
    });
  });
});
