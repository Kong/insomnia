import path from 'path';
import * as electron from 'electron';
import * as models from '../../models';
import {globalBeforeEach} from '../../__jest__/before-each';

describe('migrate()', () => {
  beforeEach(async () => {
    await globalBeforeEach();
    Date.now = jest.genMockFunction().mockReturnValue(1234567890);
    jest.useFakeTimers();
  });

  it('migrates utf8 body correctly', async () => {
    const initialModel = {body: 'hello world!', encoding: 'utf8'};

    const newModel = await models.initModel(models.response.type, initialModel);
    const expectedBodyPath = path.join(
      electron.remote.app.getPath('userData'),
      `responses/fc3ff98e8c6a0d3087d515c0473f8677.zip`
    );
    const storedBody = models.response.getBodyBuffer(newModel);

    // Should have set bodyPath and stored the body
    expect(newModel.bodyPath).toBe(expectedBodyPath);
    expect(storedBody + '').toBe('hello world!');

    // Should have stripped these
    expect(newModel.body).toBeUndefined();
    expect(newModel.encoding).toBeUndefined();
  });

  it('migrates base64 body correctly', async () => {
    const initialModel = {body: 'aGVsbG8gd29ybGQh', encoding: 'base64'};

    const newModel = await models.initModel(models.response.type, initialModel);
    jest.runAllTimers();
    const expectedBodyPath = path.join(
      electron.remote.app.getPath('userData'),
      `responses/fc3ff98e8c6a0d3087d515c0473f8677.zip`
    );
    const storedBody = models.response.getBodyBuffer(newModel);

    // Should have stripped these
    expect(newModel.body).toBeUndefined();
    expect(newModel.encoding).toBeUndefined();

    // Should have set bodyPath and stored the body
    expect(newModel.bodyPath).toBe(expectedBodyPath);
    expect(storedBody + '').toBe('hello world!');
  });

  it('migrates empty body', async () => {
    const initialModel = {body: ''};

    const newModel = await models.initModel(models.response.type, initialModel);
    jest.runAllTimers();
    jest.runAllTimers();

    const expectedBodyPath = path.join(
      electron.remote.app.getPath('userData'),
      'responses/d41d8cd98f00b204e9800998ecf8427e.zip'
    );
    const storedBody = models.response.getBodyBuffer(newModel);

    // Should have stripped these
    expect(newModel.body).toBeUndefined();
    expect(newModel.encoding).toBeUndefined();

    // Should have set bodyPath and stored the body
    expect(newModel.bodyPath).toBe(expectedBodyPath);
    expect(storedBody + '').toBe('');
  });

  it('does not migrate body again', async () => {
    const initialModel = {bodyPath: '/foo/bar'};

    const newModel = await models.initModel(models.response.type, initialModel);

    // Should have stripped these
    expect(newModel.body).toBeUndefined();
    expect(newModel.encoding).toBeUndefined();

    // Should have set bodyPath and stored the body
    expect(newModel.bodyPath).toBe('/foo/bar');
  });

  it('migrates leaves bodyCompression for null', async () => {
    expect((await models.initModel(models.response.type, {
      bodyPath: '/foo/bar',
      bodyCompression: null
    })).bodyCompression).toBe(null);
  });

  it('migrates sets bodyCompression to null if does not have one yet', async () => {
    expect((await models.initModel(models.response.type, {
      bodyPath: '/foo/bar'
    })).bodyCompression).toBe(null);
  });

  it('migrates leaves bodyCompression if string', async () => {
    expect((await models.initModel(models.response.type, {
      bodyPath: '/foo/bar',
      bodyCompression: 'zip'
    })).bodyCompression).toBe('zip');
  });
});
