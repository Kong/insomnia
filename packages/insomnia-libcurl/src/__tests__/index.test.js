const {Curl} = require('../curl');

describe('Curl', () => {
  it('hello', () => {
    const curl = new Curl();
    expect(curl).toBeDefined();
  });
});
