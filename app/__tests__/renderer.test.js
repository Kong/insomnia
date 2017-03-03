import * as renderer from '../renderer';

describe('imports', () => {
  it('ui module should import successfully', () => {
    expect(renderer).toBeDefined();
  });
});
