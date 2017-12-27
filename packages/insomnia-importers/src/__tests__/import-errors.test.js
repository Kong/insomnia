'use strict';

const importers = require('../../index');

describe('Import errors', () => {
  it('fail to find importer', async () => {
    const fn = importers.convert('foo');
    await expect(fn).rejects.toHaveProperty('message', 'No importers found for file');
    //Bug in jest, that doesn't allow to check the error message using #toThrow
    //Check: https://github.com/facebook/jest/pull/4884
  })
});
