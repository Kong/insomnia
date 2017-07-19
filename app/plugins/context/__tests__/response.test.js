import * as plugin from '../response';

const PLUGIN = {
  name: 'my-plugin',
  version: '1.0.0',
  directory: '/plugins/my-plugin',
  module: {}
};

describe('init()', () => {
  beforeEach(global.insomniaBeforeEach);
  it('initializes correctly', async () => {
    const result = plugin.init(PLUGIN, {});
    expect(Object.keys(result)).toEqual(['response']);
    expect(Object.keys(result.response)).toEqual([
      'getRequestId',
      'getStatusCode',
      'getStatusMessage',
      'getBytesRead',
      'getTime',
      'getBody'
    ]);
  });

  it('fails to initialize without response', () => {
    expect(() => plugin.init(PLUGIN))
      .toThrowError('contexts.response initialized without response');
  });
});

describe('response.*', () => {
  beforeEach(global.insomniaBeforeEach);
  it('works for basic and full response', async () => {
    const response = {
      parentId: 'req_1',
      url: 'https://insomnia.rest',
      statusCode: 200,
      statusMessage: 'OK',
      bytesRead: 123,
      elapsedTime: 321
    };
    const result = plugin.init(PLUGIN, response, Buffer.from('Hello World!'));
    expect(result.response.getRequestId()).toBe('req_1');
    expect(result.response.getStatusCode()).toBe(200);
    expect(result.response.getBytesRead()).toBe(123);
    expect(result.response.getTime()).toBe(321);
    expect(result.response.getBody().toString()).toBe('Hello World!');
  });

  it('works for basic and empty response', async () => {
    const result = plugin.init(PLUGIN, {});
    expect(result.response.getRequestId()).toBe('');
    expect(result.response.getStatusCode()).toBe(0);
    expect(result.response.getBytesRead()).toBe(0);
    expect(result.response.getTime()).toBe(0);
    expect(result.response.getBody()).toBeNull();
  });
});
