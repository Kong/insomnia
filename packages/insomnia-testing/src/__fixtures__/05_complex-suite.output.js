const assert = require('assert');

describe('Parent Suite', () => {
  describe('Nested Suite', () => {
    describe('Nested Again Suite', () => {
      it('should return -1 when the value is not present', async () => {
        assert.equal([1, 2, 3].indexOf(4), -1);
        assert.equal(true, true);
      });

      it('should be true', async () => {
        assert.equal(true, true);
      });
    });
  });

  it('should return -1 when the value is not present', async () => {
    assert.equal([1, 2, 3].indexOf(4), -1);
    assert.equal(true, true);
  });

  it('is an empty test', async () => {
  });
});
