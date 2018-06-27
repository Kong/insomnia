import * as models from '../index';
import { globalBeforeEach } from '../../__jest__/before-each';

describe('init()', () => {
  beforeEach(globalBeforeEach);
  it('contains all required fields', async () => {
    Date.now = jest.fn().mockReturnValue(1478795580200);
    expect(models.request.init()).toEqual({
      isPrivate: false,
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
      settingEncodeUrl: true,
      settingRebuildPath: true,
      settingMaxTimelineDataSize: 1000
    });
  });
});

describe('create()', async () => {
  beforeEach(globalBeforeEach);
  it('creates a valid request', async () => {
    Date.now = jest.fn().mockReturnValue(1478795580200);

    const request = await models.request.create({
      name: 'Test Request',
      parentId: 'fld_124',
      description: 'A test Request'
    });
    const expected = {
      _id: 'req_cc1dd2ca4275747aa88199e8efd42403',
      isPrivate: false,
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
      settingEncodeUrl: true,
      settingRebuildPath: true,
      settingMaxTimelineDataSize: 1000
    };

    expect(request).toEqual(expected);
    expect(await models.request.getById(expected._id)).toEqual(expected);
  });

  it('fails when missing parentId', async () => {
    Date.now = jest.fn().mockReturnValue(1478795580200);
    expect(() => models.request.create({ name: 'Test Request' })).toThrow(
      'New Requests missing `parentId`'
    );
  });
});

describe('updateMimeType()', async () => {
  beforeEach(globalBeforeEach);
  it('adds header when does not exist', async () => {
    const request = await models.request.create({
      name: 'My Request',
      parentId: 'fld_1'
    });
    expect(request).not.toBeNull();

    const newRequest = await models.request.updateMimeType(
      request,
      'text/html'
    );
    expect(newRequest.headers).toEqual([
      { name: 'Content-Type', value: 'text/html' }
    ]);
  });

  it('replaces header when exists', async () => {
    const request = await models.request.create({
      name: 'My Request',
      parentId: 'fld_1',
      headers: [
        { name: 'content-tYPE', value: 'application/json' },
        { name: 'foo', value: 'bar' },
        { bad: true },
        null
      ]
    });
    expect(request).not.toBeNull();

    const newRequest = await models.request.updateMimeType(
      request,
      'text/html'
    );
    expect(newRequest.headers).toEqual([
      { name: 'content-tYPE', value: 'text/html' },
      { name: 'foo', value: 'bar' },
      { bad: true },
      null
    ]);
  });

  it('replaces header when exists', async () => {
    const request = await models.request.create({
      name: 'My Request',
      parentId: 'fld_1',
      headers: [{ name: 'content-tYPE', value: 'application/json' }]
    });
    expect(request).not.toBeNull();

    const newRequest = await models.request.updateMimeType(
      request,
      'text/html'
    );
    expect(newRequest.headers).toEqual([
      { name: 'content-tYPE', value: 'text/html' }
    ]);
  });

  it('keeps content-type', async () => {
    const request = await models.request.create({
      name: 'My Request',
      parentId: 'fld_1',
      headers: [{ name: 'content-tYPE', value: 'application/json' }]
    });
    expect(request).not.toBeNull();

    const newRequest = await models.request.updateMimeType(request, null);
    expect(newRequest.body).toEqual({});
    expect(newRequest.headers).toEqual([
      { name: 'content-tYPE', value: 'application/json' }
    ]);
  });

  it('uses saved body when provided', async () => {
    const request = await models.request.create({
      name: 'My Request',
      parentId: 'fld_1',
      body: {
        text: 'My Data'
      }
    });
    expect(request).not.toBeNull();

    const newRequest = await models.request.updateMimeType(
      request,
      'application/json',
      false,
      { text: 'Saved Data' }
    );
    expect(newRequest.body.text).toEqual('Saved Data');
  });

  it('uses existing body when saved body not provided', async () => {
    const request = await models.request.create({
      name: 'My Request',
      parentId: 'fld_1',
      body: {
        text: 'My Data'
      }
    });
    expect(request).not.toBeNull();

    const newRequest = await models.request.updateMimeType(
      request,
      'application/json',
      false,
      {}
    );
    expect(newRequest.body.text).toEqual('My Data');
  });
});

describe('migrate()', () => {
  beforeEach(globalBeforeEach);
  it('migrates basic case', () => {
    const original = {
      headers: [],
      body: 'hello world!'
    };

    const expected = {
      headers: [],
      body: { mimeType: '', text: 'hello world!' },
      url: ''
    };

    expect(models.request.migrate(original)).toEqual(expected);
  });

  it('migrates form-urlencoded', () => {
    const original = {
      headers: [
        { name: 'content-type', value: 'application/x-www-form-urlencoded' }
      ],
      body: 'foo=bar&baz={{ hello }}'
    };

    const expected = {
      headers: [
        { name: 'content-type', value: 'application/x-www-form-urlencoded' }
      ],
      body: {
        mimeType: 'application/x-www-form-urlencoded',
        params: [
          { name: 'foo', value: 'bar' },
          { name: 'baz', value: '{{ hello }}' }
        ]
      },
      url: ''
    };

    expect(models.request.migrate(original)).toEqual(expected);
  });

  it('migrates form-urlencoded with charset', () => {
    const original = {
      headers: [
        {
          name: 'content-type',
          value: 'application/x-www-form-urlencoded; charset=utf-8'
        }
      ],
      body: 'foo=bar&baz={{ hello }}'
    };

    const expected = {
      headers: [
        {
          name: 'content-type',
          value: 'application/x-www-form-urlencoded; charset=utf-8'
        }
      ],
      body: {
        mimeType: 'application/x-www-form-urlencoded',
        params: [
          { name: 'foo', value: 'bar' },
          { name: 'baz', value: '{{ hello }}' }
        ]
      },
      url: ''
    };

    expect(models.request.migrate(original)).toEqual(expected);
  });

  it('migrates form-urlencoded malformed', () => {
    const original = {
      headers: [
        { name: 'content-type', value: 'application/x-www-form-urlencoded' }
      ],
      body: '{"foo": "bar"}'
    };

    const expected = {
      headers: [
        { name: 'content-type', value: 'application/x-www-form-urlencoded' }
      ],
      body: {
        mimeType: 'application/x-www-form-urlencoded',
        params: [{ name: '{"foo": "bar"}', value: '' }]
      },
      url: ''
    };

    expect(models.request.migrate(original)).toEqual(expected);
  });

  it('migrates mime-type', () => {
    const contentToMimeMap = {
      'application/json; charset=utf-8': 'application/json',
      'text/plain': 'text/plain',
      malformed: 'malformed'
    };

    for (const contentType of Object.keys(contentToMimeMap)) {
      const original = {
        headers: [{ name: 'content-type', value: contentType }],
        body: ''
      };

      const expected = {
        headers: [{ name: 'content-type', value: contentType }],
        body: { mimeType: contentToMimeMap[contentType], text: '' },
        url: ''
      };

      expect(models.request.migrate(original)).toEqual(expected);
    }
  });

  it('skips migrate for schema 1', () => {
    const original = {
      body: { mimeType: 'text/plain', text: 'foo' }
    };

    expect(models.request.migrate(original)).toBe(original);
  });

  it('migrates with weird data', () => {
    const newBody = { body: { mimeType: '', text: 'foo bar!' } };
    const stringBody = { body: 'foo bar!' };
    const nullBody = { body: null };
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

    expect(models.request.migrate(newBody)).toEqual(expected);
    expect(models.request.migrate(stringBody)).toEqual(expected);
    expect(models.request.migrate(nullBody)).toEqual(expected2);
    expect(models.request.migrate(noBody)).toEqual(expected2);
  });

  it('migrates from initModel()', async () => {
    Date.now = jest.fn().mockReturnValue(1478795580200);

    const original = {
      _id: 'req_123',
      headers: [],
      body: 'hello world!'
    };

    const expected = {
      _id: 'req_123',
      isPrivate: false,
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
      body: { mimeType: '', text: 'hello world!' },
      settingStoreCookies: true,
      settingSendCookies: true,
      settingDisableRenderRequestBody: false,
      settingEncodeUrl: true,
      settingRebuildPath: true,
      settingMaxTimelineDataSize: 1000
    };

    const migrated = await models.initModel(models.request.type, original);
    expect(migrated).toEqual(expected);
  });
});
