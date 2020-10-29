import * as models from '../index';
import { globalBeforeEach } from '../../__jest__/before-each';

describe('init()', () => {
  beforeEach(globalBeforeEach);
  it('contains all required fields', async () => {
    expect(models.grpcRequestMeta.init()).toEqual({
      pinned: false,
      lastActive: 0,
    });
  });
});

describe('create()', () => {
  beforeEach(globalBeforeEach);
  it('creates a valid GrpcRequest', async () => {
    Date.now = jest.fn().mockReturnValue(1478795580200);

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

  it('creates a valid GrpcRequestMeta if it does not exist', async () => {
    Date.now = jest.fn().mockReturnValue(1478795580200);

    const request = await models.grpcRequestMeta.getOrCreateByParentId('greq_124');
    const expected = {
      _id: 'greqm_dd2ccc1a2745477a881a9e8ef9d42403',
      created: 1478795580200,
      modified: 1478795580200,
      parentId: 'greq_124',
      pinned: false,
      type: 'GrpcRequestMeta',
      lastActive: 0,
    };

    expect(request).toEqual(expected);
  });

  it('fails when missing parentId', async () => {
    expect(() => models.grpcRequestMeta.create({ pinned: true })).toThrow(
      'New GrpcRequestMeta missing `parentId`',
    );
  });

  it('fails when parentId prefix is not that of a GrpcRequest', async () => {
    expect(() => models.grpcRequestMeta.create({ parentId: 'req_123' })).toThrow(
      'Expected the parent of GrpcRequestMeta to be a GrpcRequest',
    );
  });
});
