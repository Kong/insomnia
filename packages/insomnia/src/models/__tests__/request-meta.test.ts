import { beforeEach, describe, expect, it } from '@jest/globals';

import { globalBeforeEach } from '../../__jest__/before-each';
import * as models from '../index';

describe('create()', () => {
  beforeEach(globalBeforeEach);

  it('fails when missing parentId', async () => {
    expect(() =>
      models.requestMeta.create({
        pinned: true,
      }),
    ).toThrow('New RequestMeta missing `parentId`');
  }); // it('fails when parentId prefix is not that of a Request', async () => {
  //   expect(() => models.requestMeta.create({ parentId: 'greq_123' })).toThrow(
  //     'Expected the parent of RequestMeta to be a Request',
  //   );
  // });
});
