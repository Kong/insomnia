'use strict';

const importers = require('../../index');

describe('Import errors', () => {
  it('fail to find importer', () => {
    const fn = () => importers.convert('foo');
    expect(fn).toThrowError('No importers found for file')
  })
});
