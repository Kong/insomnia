import { describe, expect, it, vi } from 'vitest';

import { models, services } from '~/insomnia-data';

describe('init()', () => {
  it('contains all required fields', async () => {
    expect(models.grpcRequestMeta.init()).toEqual({
      pinned: false,
      lastActive: 0,
    });
  });
});

describe('create()', () => {
  it('creates a valid GrpcRequest', async () => {
    Date.now = vi.fn().mockReturnValue(1_478_795_580_200);
    const request = await services.grpcRequestMeta.create({
      pinned: true,
      parentId: 'greq_124',
    });
    const expected = {
      _id: 'greqm_cc1dd2ca4275747aa88199e8efd42403',
      created: 1_478_795_580_200,
      modified: 1_478_795_580_200,
      parentId: 'greq_124',
      pinned: true,
      type: 'GrpcRequestMeta',
      lastActive: 0,
    };
    expect(request).toEqual(expected);
    expect(await services.grpcRequestMeta.getOrCreateByParentId(expected.parentId)).toEqual(expected);
  });

  it('fails when missing parentId', async () => {
    expect(() =>
      services.grpcRequestMeta.create({
        pinned: true,
      }),
    ).toThrow('New GrpcRequestMeta missing `parentId`');
  });

  it('fails when parentId prefix is not that of a GrpcRequest', async () => {
    expect(() =>
      services.grpcRequestMeta.create({
        parentId: 'req_123',
      }),
    ).toThrow('Expected the parent of GrpcRequestMeta to be a GrpcRequest');
  });
});
