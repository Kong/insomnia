import * as renderer from '../renderer';
import { globalBeforeEach } from '../__jest__/before-each';

describe('imports', () => {
  beforeEach(globalBeforeEach);
  it('ui module should import successfully', () => {
    expect(renderer).toBeDefined();
  });
});
