import * as plugin from '../request';
import * as models from '../../../models';

const PLUGIN = {
  name: 'my-plugin',
  version: '1.0.0',
  directory: '/plugins/my-plugin',
  module: {}
};

describe('init()', () => {
  beforeEach(async () => {
    await global.insomniaBeforeEach();
    await models.workspace.create({_id: 'wrk_1', name: 'My Workspace'});
    await models.request.create({_id: 'req_1', parentId: 'wrk_1', name: 'My Request'});
  });

  it('initializes correctly', async () => {
    const result = plugin.init(PLUGIN, await models.request.getById('req_1'));
    expect(Object.keys(result)).toEqual(['request']);
    expect(Object.keys(result.request)).toEqual([
      'getId',
      'getName',
      'getUrl',
      'getMethod',
      'getHeader',
      'hasHeader',
      'removeHeader',
      'setHeader',
      'addHeader',
      'setCookie'
    ]);
  });

  it('fails to initialize without request', () => {
    expect(() => plugin.init(PLUGIN))
      .toThrowError('contexts.request initialized without request');
  });
});

describe('request.*', () => {
  beforeEach(async () => {
    await global.insomniaBeforeEach();
    await models.workspace.create({_id: 'wrk_1', name: 'My Workspace'});
    await models.request.create({
      _id: 'req_1',
      parentId: 'wrk_1',
      name: 'My Request',
      headers: [
        {name: 'hello', value: 'world'},
        {name: 'Content-Type', value: 'application/json'}
      ]
    });
  });

  it('works for basic getters', async () => {
    const result = plugin.init(PLUGIN, await models.request.getById('req_1'));
    expect(result.request.getId()).toBe('req_1');
    expect(result.request.getName()).toBe('My Request');
    expect(result.request.getUrl()).toBe('');
    expect(result.request.getMethod()).toBe('GET');
  });

  it('works for headers', async () => {
    const result = plugin.init(PLUGIN, await models.request.getById('req_1'));

    // getHeader()
    expect(result.request.getHeader('content-type')).toBe('application/json');
    expect(result.request.getHeader('CONTENT-TYPE')).toBe('application/json');
    expect(result.request.getHeader('does-not-exist')).toBe(null);
    expect(result.request.hasHeader('Content-Type')).toBe(true);

    // setHeader()
    result.request.setHeader('content-type', 'text/plain');
    expect(result.request.getHeader('Content-Type')).toBe('text/plain');

    // addHeader()
    result.request.addHeader('content-type', 'new/type');
    result.request.addHeader('something-else', 'foo');
    expect(result.request.getHeader('Content-Type')).toBe('text/plain');
    expect(result.request.getHeader('something-else')).toBe('foo');

    // removeHeader()
    result.request.removeHeader('content-type');
    expect(result.request.getHeader('Content-Type')).toBe(null);
    expect(result.request.hasHeader('Content-Type')).toBe(false);
  });

  it('works for cookies', async () => {
    const request = await models.request.getById('req_1');
    request.cookies = []; // Because the plugin technically needs a RenderedRequest

    const result = plugin.init(PLUGIN, request);

    result.request.setCookie('foo', 'bar');
    result.request.setCookie('foo', 'baz');
    expect(request.cookies).toEqual([{name: 'foo', value: 'baz'}]);
  });
});
