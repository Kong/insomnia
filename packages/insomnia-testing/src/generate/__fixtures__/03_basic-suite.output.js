const { expect } = chai;

// Clear active request before test starts (will be set inside test)
beforeEach(() => insomnia.clearActiveRequest());

describe('Example Suite', () => {
  it('should return -1 when the value is not present', async () => {
    expect([1, 2, 3].indexOf(4)).to.equal(-1);
    expect(true).to.equal(true);
  });

  it('is an empty test', async () => {
  });
});
