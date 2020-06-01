const assert = require('assert');

describe('Example Suite', () => {
  it('should return -1 when the value is not present', async () => {
    assert.equal([1, 2, 3].indexOf(4), -1);
    assert.equal(true, true);
  });

  it('is an empty test', async () => {
  });
});
