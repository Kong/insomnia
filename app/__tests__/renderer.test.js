import * as renderer from '../renderer';

describe('imports', () => {
  beforeEach(global.insomniaBeforeEach);
  it('ui module should import successfully', () => {
    expect(renderer).toBeDefined();
  });
});
