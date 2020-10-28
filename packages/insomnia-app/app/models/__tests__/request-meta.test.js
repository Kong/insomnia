import * as models from '../index';
import { globalBeforeEach } from '../../__jest__/before-each';

describe('create()', () => {
  beforeEach(globalBeforeEach);

  it('fails when parentId prefix is not that of a Request', async () => {
    Date.now = jest.fn().mockReturnValue(1478795580200);
    expect(() => models.requestMeta.create({ parentId: 'greq_123' })).toThrow(
      'Expected the parent of RequestMeta to be a Request',
    );
  });
});
