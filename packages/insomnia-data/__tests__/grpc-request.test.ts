import { models, services } from 'insomnia-data';
import { describe, expect, it, vi } from 'vitest';

describe('init()', () => {
  it('contains all required fields', async () => {
    Date.now = vi.fn().mockReturnValue(1_478_795_580_200);
    expect(models.grpcRequest.init()).toEqual({
      url: '',
      name: 'New gRPC Request',
      description: '',
      protoFileId: '',
      protoMethodName: '',
      metadata: [],
      body: {
        text: '{}',
      },
      reflectionApi: {
        enabled: false,
        apiKey: '',
        module: 'buf.build/connectrpc/eliza',
        url: 'https://buf.build',
      },
      metaSortKey: -1_478_795_580_200,
      isPrivate: false,
    });
  });
});

describe('create()', () => {
  it('creates a valid GrpcRequest', async () => {
    Date.now = vi.fn().mockReturnValue(1_478_795_580_200);
    const request = await services.grpcRequest.create({
      name: 'My request',
      parentId: 'fld_124',
    });
    const expected = {
      _id: 'greq_cc1dd2ca4275747aa88199e8efd42403',
      created: 1_478_795_580_200,
      modified: 1_478_795_580_200,
      parentId: 'fld_124',
      name: 'My request',
      description: '',
      url: '',
      protoFileId: '',
      protoMethodName: '',
      metadata: [],
      body: {
        text: '{}',
      },
      reflectionApi: {
        enabled: false,
        apiKey: '',
        module: 'buf.build/connectrpc/eliza',
        url: 'https://buf.build',
      },
      metaSortKey: -1_478_795_580_200,
      isPrivate: false,
      type: 'GrpcRequest',
    };
    expect(request).toEqual(expected);
    expect(await services.grpcRequest.getById(expected._id)).toEqual(expected);
  });

  it('fails when missing parentId', async () => {
    Date.now = vi.fn().mockReturnValue(1_478_795_580_200);
    expect(() =>
      services.grpcRequest.create({
        name: 'no parentId',
      }),
    ).toThrow('New GrpcRequest missing `parentId`');
  });
});
