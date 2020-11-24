import * as models from '../index';
import { globalBeforeEach } from '../../__jest__/before-each';

describe('init()', () => {
  beforeEach(globalBeforeEach);
  it('contains all required fields', async () => {
    Date.now = jest.fn().mockReturnValue(1478795580200);

    expect(models.grpcRequest.init()).toEqual({
      url: '',
      name: 'New gRPC Request',
      description: '',
      protoFileId: '',
      protoMethodName: '',
      body: {
        text: '{}',
      },
      metaSortKey: -1478795580200,
      idPrivate: false,
    });
  });
});

describe('create()', () => {
  beforeEach(globalBeforeEach);
  it('creates a valid GrpcRequest', async () => {
    Date.now = jest.fn().mockReturnValue(1478795580200);

    const request = await models.grpcRequest.create({
      name: 'My request',
      parentId: 'fld_124',
    });
    const expected = {
      _id: 'greq_cc1dd2ca4275747aa88199e8efd42403',
      created: 1478795580200,
      modified: 1478795580200,
      parentId: 'fld_124',
      name: 'My request',
      description: '',
      url: '',
      protoFileId: '',
      protoMethodName: '',
      body: {
        text: '{}',
      },
      metaSortKey: -1478795580200,
      idPrivate: false,
      type: 'GrpcRequest',
    };

    expect(request).toEqual(expected);
    expect(await models.grpcRequest.getById(expected._id)).toEqual(expected);
  });

  it('fails when missing parentId', async () => {
    Date.now = jest.fn().mockReturnValue(1478795580200);
    expect(() => models.grpcRequest.create({ name: 'no parentId' })).toThrow(
      'New GrpcRequest missing `parentId`',
    );
  });
});
