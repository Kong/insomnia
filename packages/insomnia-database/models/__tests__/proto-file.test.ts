import { describe, expect, it, vi } from 'vitest';

import * as models from '../index';

describe('init()', () => {
  it('contains all required fields', async () => {
    expect(models.protoFile.init()).toEqual({
      name: 'New Proto File',
      protoText: '',
    });
  });
});

describe('create()', () => {
  it('creates a valid protofile', async () => {
    Date.now = vi.fn().mockReturnValue(1478795580200);
    const request = await models.protoFile.create({
      name: 'My File',
      parentId: 'fld_124',
      protoText: 'some proto text',
    });
    const expected = {
      _id: 'pf_cc1dd2ca4275747aa88199e8efd42403',
      created: 1478795580200,
      modified: 1478795580200,
      parentId: 'fld_124',
      type: 'ProtoFile',
      name: 'My File',
      protoText: 'some proto text',
    };
    expect(request).toEqual(expected);
    expect(await models.protoFile.getById(expected._id)).toEqual(expected);
  });

  it('fails when missing parentId', async () => {
    Date.now = vi.fn().mockReturnValue(1478795580200);
    expect(() =>
      models.protoFile.create({
        name: 'no parentId',
      }),
    ).toThrow('New ProtoFile missing `parentId`');
  });
});
