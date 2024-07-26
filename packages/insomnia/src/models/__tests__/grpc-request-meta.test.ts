import { describe, expect, it, vi } from 'vitest';

import * as models from '../index';

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
    Date.now = vi.fn().mockReturnValue(1478795580200);
    const request = await models.grpcRequestMeta.create({
      pinned: true,
      parentId: 'greq_124',
    });
    const expected = {
      _id: 'greqm_cc1dd2ca4275747aa88199e8efd42403',
      created: 1478795580200,
      modified: 1478795580200,
      parentId: 'greq_124',
      pinned: true,
      type: 'GrpcRequestMeta',
      lastActive: 0,
    };
    expect(request).toEqual(expected);
    expect(await models.grpcRequestMeta.getOrCreateByParentId(expected.parentId)).toEqual(expected);
  });

  it('fails when missing parentId', async () => {
    expect(() =>
      models.grpcRequestMeta.create({
        pinned: true,
      }),
    ).toThrow('New GrpcRequestMeta missing `parentId`');
  });

  it('fails when parentId prefix is not that of a GrpcRequest', async () => {
    expect(() =>
      models.grpcRequestMeta.create({
        parentId: 'req_123',
      }),
    ).toThrow('Expected the parent of GrpcRequestMeta to be a GrpcRequest');
  });
});
