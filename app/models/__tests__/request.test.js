import * as db from '../../common/database';
import * as requestModel from '../../models/request';
import * as models from '../index';

describe('init()', () => {
  beforeEach(() => {
    return db.init(models.types(), {inMemoryOnly: true}, true);
  });

  it('contains all required fields', async () => {
    Date.now = jest.fn().mockReturnValue(1478795580200);
    expect(requestModel.init()).toEqual({
      authentication: {},
      body: {},
      headers: [],
      metaSortKey: -1478795580200,
      method: 'GET',
      name: 'New Request',
      description: '',
      parameters: [],
      url: '',
      settingStoreCookies: true,
      settingSendCookies: true,
      settingDisableRenderRequestBody: false,
      settingEncodeUrl: true
    });
  });
});

describe('create()', async () => {
  beforeEach(() => {
    return db.init(models.types(), {inMemoryOnly: true}, true);
  });

  it('creates a valid request', async () => {
    Date.now = jest.fn().mockReturnValue(1478795580200);

    const request = await requestModel.create({name: 'Test Request', parentId: 'fld_124', description: 'A test Request'});
    const expected = {
      _id: 'req_dd2ccc1a2745477a881a9e8ef9d42403',
      created: 1478795580200,
      modified: 1478795580200,
      parentId: 'fld_124',
      type: 'Request',
      authentication: {},
      description: 'A test Request',
      body: {},
      headers: [],
      metaSortKey: -1478795580200,
      method: 'GET',
      name: 'Test Request',
      parameters: [],
      url: '',
      settingStoreCookies: true,
      settingSendCookies: true,
      settingDisableRenderRequestBody: false,
      settingEncodeUrl: true
    };

    expect(request).toEqual(expected);
    expect(await requestModel.getById(expected._id)).toEqual(expected);
  });

  it('fails when missing parentId', async () => {
    Date.now = jest.fn().mockReturnValue(1478795580200);
    expect(() => requestModel.create({name: 'Test Request'})).toThrow('New Requests missing `parentId`');
  });
});

describe('updateMimeType()', async () => {
  beforeEach(() => {
    return db.init(models.types(), {inMemoryOnly: true}, true);
  });

  it('adds header when does not exist', async () => {
    const request = await requestModel.create({name: 'My Request', parentId: 'fld_1'});
    expect(request).not.toBeNull();

    const newRequest = await requestModel.updateMimeType(request, 'text/html');
    expect(newRequest.headers).toEqual([{name: 'Content-Type', value: 'text/html'}]);
  });

  it('replaces header when exists', async () => {
    const request = await requestModel.create({
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

    const newRequest = await requestModel.updateMimeType(request, 'text/html');
    expect(newRequest.headers).toEqual([
      {name: 'content-tYPE', value: 'text/html'},
      {name: 'foo', value: 'bar'},
      {bad: true},
      null
    ]);
  });

  it('replaces header when exists', async () => {
    const request = await requestModel.create({
      name: 'My Request',
      parentId: 'fld_1',
      headers: [{name: 'content-tYPE', value: 'application/json'}]
    });
    expect(request).not.toBeNull();

    const newRequest = await requestModel.updateMimeType(request, 'text/html');
    expect(newRequest.headers).toEqual([{name: 'content-tYPE', value: 'text/html'}]);
  });

  it('removes content-type', async () => {
    const request = await requestModel.create({
      name: 'My Request',
      parentId: 'fld_1',
      headers: [{name: 'content-tYPE', value: 'application/json'}]
    });
    expect(request).not.toBeNull();

    const newRequest = await requestModel.updateMimeType(request, null);
    expect(newRequest.body).toEqual({});
    expect(newRequest.headers).toEqual([]);
  });
});

describe('migrate()', () => {
  it('migrates basic case', () => {
    const original = {
      headers: [],
      body: 'hello world!'
    };

    const expected = {
      headers: [],
      body: {mimeType: '', text: 'hello world!'},
      url: ''
    };

    expect(requestModel.migrate(original)).toEqual(expected);
  });

  it('migrates form-urlencoded', () => {
    const original = {
      headers: [{name: 'content-type', value: 'application/x-www-form-urlencoded'}],
      body: 'foo=bar&baz={{ hello }}'
    };

    const expected = {
      headers: [{name: 'content-type', value: 'application/x-www-form-urlencoded'}],
      body: {
        mimeType: 'application/x-www-form-urlencoded',
        params: [
          {name: 'foo', value: 'bar', disabled: false},
          {name: 'baz', value: '{{ hello }}', disabled: false}
        ]
      },
      url: ''
    };

    expect(requestModel.migrate(original)).toEqual(expected);
  });

  it('migrates form-urlencoded with charset', () => {
    const original = {
      headers: [{name: 'content-type', value: 'application/x-www-form-urlencoded; charset=utf-8'}],
      body: 'foo=bar&baz={{ hello }}'
    };

    const expected = {
      headers: [{name: 'content-type', value: 'application/x-www-form-urlencoded; charset=utf-8'}],
      body: {
        mimeType: 'application/x-www-form-urlencoded',
        params: [
          {name: 'foo', value: 'bar', disabled: false},
          {name: 'baz', value: '{{ hello }}', disabled: false}
        ]
      },
      url: ''
    };

    expect(requestModel.migrate(original)).toEqual(expected);
  });

  it('migrates form-urlencoded malformed', () => {
    const original = {
      headers: [{name: 'content-type', value: 'application/x-www-form-urlencoded'}],
      body: '{"foo": "bar"}'
    };

    const expected = {
      headers: [{name: 'content-type', value: 'application/x-www-form-urlencoded'}],
      body: {
        mimeType: 'application/x-www-form-urlencoded',
        params: [
          {name: '{"foo": "bar"}', value: '', disabled: false}
        ]
      },
      url: ''
    };

    expect(requestModel.migrate(original)).toEqual(expected);
  });

  it('migrates mime-type', () => {
    const contentToMimeMap = {
      'application/json; charset=utf-8': 'application/json',
      'text/plain': 'text/plain',
      'malformed': 'malformed'
    };

    for (const contentType of Object.keys(contentToMimeMap)) {
      const original = {
        headers: [{name: 'content-type', value: contentType}],
        body: ''
      };

      const expected = {
        headers: [{name: 'content-type', value: contentType}],
        body: {mimeType: contentToMimeMap[contentType], text: ''},
        url: ''
      };

      expect(requestModel.migrate(original)).toEqual(expected);
    }
  });

  it('skips migrate for schema 1', () => {
    const original = {
      body: {mimeType: 'text/plain', text: 'foo'}
    };

    expect(requestModel.migrate(original)).toBe(original);
  });

  it('migrates with weird data', () => {
    const newBody = {body: {mimeType: '', text: 'foo bar!'}};
    const stringBody = {body: 'foo bar!'};
    const nullBody = {body: null};
    const noBody = {};

    const expected = {
      body: {
        mimeType: '',
        text: 'foo bar!'
      },
      url: ''
    };

    const expected2 = {
      body: {},
      url: ''
    };

    expect(requestModel.migrate(newBody)).toEqual(expected);
    expect(requestModel.migrate(stringBody)).toEqual(expected);
    expect(requestModel.migrate(nullBody)).toEqual(expected2);
    expect(requestModel.migrate(noBody)).toEqual(expected2);
  });

  it('migrates from initModel()', () => {
    Date.now = jest.fn().mockReturnValue(1478795580200);

    const original = {
      _id: 'req_123',
      headers: [],
      body: 'hello world!'
    };

    const expected = {
      _id: 'req_123',
      type: 'Request',
      url: '',
      created: 1478795580200,
      modified: 1478795580200,
      metaSortKey: -1478795580200,
      name: 'New Request',
      description: '',
      method: 'GET',
      headers: [],
      authentication: {},
      parameters: [],
      parentId: null,
      body: {mimeType: '', text: 'hello world!'},
      settingStoreCookies: true,
      settingSendCookies: true,
      settingDisableRenderRequestBody: false,
      settingEncodeUrl: true
    };

    const migrated = models.initModel(models.request.type, original);
    expect(migrated).toEqual(expected);
  });
});
