import * as plugin from '../response';
import { globalBeforeEach } from '../../../__jest__/before-each';
import { getTempDir } from '../../../common/constants';
import fs from 'fs';
import path from 'path';
import * as models from '../../../models/index';

describe('init()', () => {
  beforeEach(globalBeforeEach);
  it('initializes correctly', async () => {
    const result = plugin.init({});
    expect(Object.keys(result)).toEqual(['response']);
    expect(Object.keys(result.response).sort()).toEqual([
      'getBody',
      'getBodyStream',
      'getBytesRead',
      'getHeader',
      'getRequestId',
      'getStatusCode',
      'getStatusMessage',
      'getTime',
      'hasHeader',
      'setBody'
    ]);
  });

  it('fails to initialize without response', () => {
    expect(() => plugin.init()).toThrowError(
      'contexts.response initialized without response'
    );
  });
});

describe('response.*', () => {
  beforeEach(globalBeforeEach);
  it('works for basic and full response', async () => {
    const bodyPath = path.join(getTempDir(), 'response.zip');
    fs.writeFileSync(bodyPath, Buffer.from('Hello World!'));
    const response = await models.initModel(models.response.type, {
      bodyPath,
      bodyCompression: null,
      parentId: 'req_1',
      url: 'https://insomnia.rest',
      statusCode: 200,
      statusMessage: 'OK',
      bytesRead: 123,
      elapsedTime: 321
    });
    const result = plugin.init(response);
    expect(result.response.getRequestId()).toBe('req_1');
    expect(result.response.getStatusCode()).toBe(200);
    expect(result.response.getBytesRead()).toBe(123);
    expect(result.response.getTime()).toBe(321);
    expect(result.response.getBody().toString()).toBe('Hello World!');
  });

  it('works for basic and empty response', async () => {
    const result = plugin.init({});
    expect(result.response.getRequestId()).toBe('');
    expect(result.response.getStatusCode()).toBe(0);
    expect(result.response.getBytesRead()).toBe(0);
    expect(result.response.getTime()).toBe(0);
    expect(result.response.getBody().length).toBe(0);
  });

  it('works for getting headers', () => {
    const response = {
      headers: [
        { name: 'content-type', value: 'application/json' },
        { name: 'set-cookie', value: 'foo=bar' },
        { name: 'set-cookie', value: 'baz=qux' }
      ]
    };
    const result = plugin.init(response);
    expect(result.response.getHeader('Does-Not-Exist')).toBeNull();
    expect(result.response.getHeader('CONTENT-TYPE')).toBe('application/json');
    expect(result.response.getHeader('set-cookie')).toEqual([
      'foo=bar',
      'baz=qux'
    ]);
    expect(result.response.hasHeader('foo')).toBe(false);
    expect(result.response.hasHeader('ConTent-Type')).toBe(true);
  });
});
