import * as db from '../../common/database';
import * as models from '../../models';

describe('init()', () => {
  beforeEach(() => {
    return db.initDB(models.types(), {inMemoryOnly: true}, true);
  });
  it('contains all required fields', async () => {
    Date.now = jest.genMockFunction().mockReturnValue(1478795580200);
    expect(models.request.init()).toEqual({
      authentication: {},
      body: '',
      headers: [],
      metaPreviewMode: 'source',
      metaResponseFilter: '',
      metaSortKey: -1478795580200,
      method: 'GET',
      name: 'New Request',
      parameters: [],
      url: ''
    });
  });
});

describe('create()', async () => {
  beforeEach(() => {
    return db.initDB(models.types(), {inMemoryOnly: true}, true);
  });

  it('creates a valid request', async () => {
    Date.now = jest.genMockFunction().mockReturnValue(1478795580200);

    const request = await models.request.create({name: 'Test Request', parentId: 'fld_124'});
    const expected = {
      _id: 'req_dd2ccc1a2745477a881a9e8ef9d42403',
      created: 1478795580200,
      modified: 1478795580200,
      parentId: 'fld_124',
      type: 'Request',
      authentication: {},
      body: '',
      headers: [],
      metaPreviewMode: 'source',
      metaResponseFilter: '',
      metaSortKey: -1478795580200,
      method: 'GET',
      name: 'Test Request',
      parameters: [],
      url: ''
    };

    expect(request).toEqual(expected);
    expect(await models.request.getById(expected._id)).toEqual(expected);
  });

  it('fails when missing parentId', async () => {
    Date.now = jest.genMockFunction().mockReturnValue(1478795580200);
    expect(() => models.request.create({name: 'Test Request'})).toThrow('New Requests missing `parentId`')
  });
});

describe('updateContentType()', async () => {
  beforeEach(() => {
    return db.initDB(models.types(), {inMemoryOnly: true}, true);
  });

  it('adds header when does not exist', async () => {
    const request = await models.request.create({name: 'My Request', parentId: 'fld_1'});
    expect(request).not.toBeNull();

    const newRequest = await models.request.updateContentType(request, 'text/html');
    expect(newRequest.headers).toEqual([{name: 'Content-Type', value: 'text/html'}]);
  });

  it('replaces header when exists', async () => {
    const request = await models.request.create({
      name: 'My Request',
      parentId: 'fld_1',
      headers: [
        {name: 'content-tYPE', value: 'application/json'},
        {name: 'foo', value: 'bar'},
        {bad: true},
        null
      ]
    });
    expect(request).not.toBeNull();

    const newRequest = await models.request.updateContentType(request, 'text/html');
    expect(newRequest.headers).toEqual([
      {name: 'content-tYPE', value: 'text/html'},
      {name: 'foo', value: 'bar'},
      {bad: true},
      null
    ]);
  });

  it('replaces header when exists', async () => {
    const request = await models.request.create({
      name: 'My Request',
      parentId: 'fld_1',
      headers: [{name: 'content-tYPE', value: 'application/json'}]
    });
    expect(request).not.toBeNull();

    const newRequest = await models.request.updateContentType(request, 'text/html');
    expect(newRequest.headers).toEqual([{name: 'content-tYPE', value: 'text/html'}]);
  });

  it('removes content-type', async () => {
    const request = await models.request.create({
      name: 'My Request',
      parentId: 'fld_1',
      headers: [{name: 'content-tYPE', value: 'application/json'}]
    });
    expect(request).not.toBeNull();

    const newRequest = await models.request.updateContentType(request, null);
    expect(newRequest.headers).toEqual([]);
  });
});

