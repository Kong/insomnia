import { describe, expect, it } from '@jest/globals';
import { fail } from 'assert';

import { checkInvalidPeriod, convert } from './convert';

describe('Import errors', () => {
  it('fail to find importer', async () => {
    try {
      await convert('foo');
      fail('Should have thrown error');
    } catch (err) {
      expect(err.message).toBe('No importers found for file');
    }
  });
});

describe('test checkInvalidPeriod', () => {
  [
    {
      input: {
        '.hehe': 'haha',
      },
      noError: false,
    },
    {
      input: {
        '.': '',
        'arr': [''],
      },
      noError: false,
    },
    {
      input: [
        '',
        1,
      ],
      noError: true,
    },
  ].forEach(testCase => {
    it(`check: ${testCase.input}`, () => {
      let e: Error | undefined = undefined;

      try {
        dotInKeyNameInvariant(testCase.input);
      } catch (ex) {
        e = ex;
      }
      expect(e === undefined).toBe(testCase.noError);
    });
  });
});
