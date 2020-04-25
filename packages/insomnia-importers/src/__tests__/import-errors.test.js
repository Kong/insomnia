'use strict';

const importers = require('../../index');

describe('Import errors', () => {
  it('fail to find importer', async () => {
    try {
      await importers.convert('foo');
      fail('Should have thrown error');
    } catch (err) {
      expect(err.message).toBe('No importers found for file');
    }
  });
});
