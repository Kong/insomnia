import { services } from 'insomnia-data';
import { describe, expect, it } from 'vitest';

describe('create()', () => {
  it('fails when missing parentId', async () => {
    expect(() =>
      services.requestMeta.create({
        pinned: true,
      }),
    ).toThrow('New RequestMeta missing `parentId`');
  }); // it('fails when parentId prefix is not that of a Request', async () => {
  //   expect(() => services.requestMeta.create({ parentId: 'greq_123' })).toThrow(
  //     'Expected the parent of RequestMeta to be a Request',
  //   );
  // });
});
