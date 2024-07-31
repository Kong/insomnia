import { describe, expect, it } from 'vitest';

import * as models from '../index';

describe('create()', () => {

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
