import path from 'path';
import zlib from 'zlib';
import fs from 'fs';
import * as models from '../../models';
import { globalBeforeEach } from '../../__jest__/before-each';
import { getDataDirectory } from '../../common/misc';

describe('migrate()', () => {
  beforeEach(async () => {
    await globalBeforeEach();
    Date.now = jest.fn(() => 1234567890);
    jest.useFakeTimers();
  });

  afterEach(async () => {
    // Reset to real timers so that other test suites don't fail.
    jest.useRealTimers();
  });

  it('migrates utf8 body correctly', async () => {
    const initialModel = { body: 'hello world!', encoding: 'utf8' };

    const newModel = await models.initModel(models.response.type, initialModel);
    const expectedBodyPath = path.join(
      getDataDirectory(),
      `responses/fc3ff98e8c6a0d3087d515c0473f8677.zip`,
    );
    const storedBody = models.response.getBodyBuffer(newModel);

    // Should have set bodyPath and stored the body
    expect(newModel.bodyPath).toBe(expectedBodyPath);
    expect(storedBody.toString()).toBe('hello world!');

    // Should have stripped these
    expect(newModel.body).toBeUndefined();
    expect(newModel.encoding).toBeUndefined();
  });

  it('migrates base64 body correctly', async () => {
    const initialModel = { body: 'aGVsbG8gd29ybGQh', encoding: 'base64' };

    const newModel = await models.initModel(models.response.type, initialModel);
    jest.runAllTimers();
    const expectedBodyPath = path.join(
      getDataDirectory(),
      `responses/fc3ff98e8c6a0d3087d515c0473f8677.zip`,
    );
    const storedBody = models.response.getBodyBuffer(newModel);

    // Should have stripped these
    expect(newModel.body).toBeUndefined();
    expect(newModel.encoding).toBeUndefined();

    // Should have set bodyPath and stored the body
    expect(newModel.bodyPath).toBe(expectedBodyPath);
    expect(storedBody.toString()).toBe('hello world!');
  });

  it('migrates empty body', async () => {
    const initialModel = { body: '' };

    const newModel = await models.initModel(models.response.type, initialModel);
    jest.runAllTimers();
    jest.runAllTimers();

    const expectedBodyPath = path.join(
      getDataDirectory(),
      'responses/d41d8cd98f00b204e9800998ecf8427e.zip',
    );
    const storedBody = models.response.getBodyBuffer(newModel);

    // Should have stripped these
    expect(newModel.body).toBeUndefined();
    expect(newModel.encoding).toBeUndefined();

    // Should have set bodyPath and stored the body
    expect(newModel.bodyPath).toBe(expectedBodyPath);
    expect(storedBody.toString()).toBe('');
  });

  it('does not migrate body again', async () => {
    const initialModel = { bodyPath: '/foo/bar' };

    const newModel = await models.initModel(models.response.type, initialModel);

    // Should have stripped these
    expect(newModel.body).toBeUndefined();
    expect(newModel.encoding).toBeUndefined();

    // Should have set bodyPath and stored the body
    expect(newModel.bodyPath).toBe('/foo/bar');
  });

  it('does it', async () => {
    const bodyPath = path.join(getDataDirectory(), 'foo.zip');
    fs.writeFileSync(bodyPath, zlib.gzipSync('Hello World!'));

    const response = await models.initModel(models.response.type, { bodyPath });
    const body = await models.response.getBodyBuffer(response).toString();

    expect(response.bodyCompression).toBe('zip');
    expect(body).toBe('Hello World!');
  });

  it('migrates old bodies', async () => {
    const response = await models.initModel(models.response.type, {
      body: 'aGVsbG8gd29ybGQh',
      encoding: 'base64',
    });
    const body = await models.response.getBodyBuffer(response).toString();

    expect(response.bodyCompression).toBe(null);
    expect(body).toBe('hello world!');
  });

  it('migrates leaves bodyCompression for null', async () => {
    expect(
      (await models.initModel(models.response.type, {
        bodyPath: '/foo/bar',
        bodyCompression: null,
      })).bodyCompression,
    ).toBe(null);
  });

  it('migrates sets bodyCompression to zip if does not have one yet', async () => {
    expect(
      (await models.initModel(models.response.type, {
        bodyPath: '/foo/bar',
      })).bodyCompression,
    ).toBe('zip');
  });

  it('migrates leaves bodyCompression if string', async () => {
    expect(
      (await models.initModel(models.response.type, {
        bodyPath: '/foo/bar',
        bodyCompression: 'zip',
      })).bodyCompression,
    ).toBe('zip');
  });
});

describe('cleanDeletedResponses()', function() {
  beforeEach(globalBeforeEach);
  afterEach(function() {
    jest.restoreAllMocks();
  });

  it('deletes nothing if there is no files in directory', async function() {
    const mockReaddirSync = jest.spyOn(fs, 'readdirSync');
    const mockUnlinkSync = jest.spyOn(fs, 'unlinkSync');
    mockReaddirSync.mockReturnValueOnce([]);
    mockUnlinkSync.mockImplementation();

    await models.response.cleanDeletedResponses();

    expect(fs.unlinkSync.mock.calls.length).toBe(0);
  });

  it('only deletes response files that are not in db', async function() {
    const responsesDir = path.join(getDataDirectory(), 'responses');
    let dbResponseIds = await createModels(responsesDir, 10);
    let notDbResponseIds = [];
    for (let index = 100; index < 110; index++) {
      notDbResponseIds.push('res_' + index);
    }

    const mockReaddirSync = jest.spyOn(fs, 'readdirSync');
    const mockUnlinkSync = jest.spyOn(fs, 'unlinkSync');
    mockReaddirSync.mockReturnValueOnce([...dbResponseIds, ...notDbResponseIds]);
    mockUnlinkSync.mockImplementation();

    await models.response.cleanDeletedResponses();

    expect(fs.unlinkSync.mock.calls.length).toBe(notDbResponseIds.length);
    Object.keys(notDbResponseIds).map(index => {
      const resId = notDbResponseIds[index];
      const bodyPath = path.join(responsesDir, resId);
      expect(fs.unlinkSync.mock.calls[index][0]).toBe(bodyPath);
    });
  });
});

/**
 * Create mock workspaces, requests, and responses as many as {@code count}.
 * @param responsesDir
 * @param count
 * @returns {Promise<string[]>} the created response ids
 */
async function createModels(responsesDir, count) {
  if (count < 1) {
    return [];
  }

  let responseIds = [];

  for (let index = 0; index < count; index++) {
    const workspaceId = 'wrk_' + index;
    const requestId = 'req_' + index;
    const responseId = 'res_' + index;

    await models.workspace.create({
      _id: workspaceId,
      created: 111,
      modified: 222,
    });
    await models.request.create({
      _id: requestId,
      parentId: workspaceId,
      created: 111,
      modified: 222,
      metaSortKey: 0,
      url: 'https://insomnia.rest',
    });

    await models.response.create({
      _id: responseId,
      parentId: requestId,
      statusCode: 200,
      body: 'foo',
      bodyPath: path.join(responsesDir, responseId),
    });
    responseIds.push(responseId);
  }

  return responseIds;
}
