import { fail } from 'assert';
import { describe, expect, it } from 'vitest';

import { convert } from './convert';

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
