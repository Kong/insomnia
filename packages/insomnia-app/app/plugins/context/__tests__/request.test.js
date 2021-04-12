import * as plugin from '../request';
import * as models from '../../../models';
import { globalBeforeEach } from '../../../__jest__/before-each';
import { CONTENT_TYPE_FORM_URLENCODED } from '../../../common/constants';

const CONTEXT = {
  user_key: 'my_user_key',
  hello: 'world',
  array_test: ['a', 'b'],
  object_test: { a: 'A', b: 'B' },
  null_test: null,
};

describe('init()', () => {
  beforeEach(async () => {
    await globalBeforeEach();
    await models.workspace.create({ _id: 'wrk_1', name: 'My Workspace' });
    await models.request.create({
      _id: 'req_1',
      parentId: 'wrk_1',
      name: 'My Request',
    });
  });

  it('initializes correctly', async () => {
    const result = plugin.init(await models.request.getById('req_1'), CONTEXT);
    expect(Object.keys(result)).toEqual(['request']);
    expect(Object.keys(result.request).sort()).toEqual([
      'addHeader',
      'addParameter',
      'getAuthentication',
      'getBody',
      'getBodyText',
      'getEnvironment',
      'getEnvironmentVariable',
      'getHeader',
      'getHeaders',
      'getId',
      'getMethod',
      'getName',
      'getParameter',
      'getParameters',
      'getUrl',
      'hasHeader',
      'hasParameter',
      'removeHeader',
      'removeParameter',
      'setAuthenticationParameter',
      'setBody',
      'setBodyText',
      'setCookie',
      'setHeader',
      'setMethod',
      'setParameter',
      'setUrl',
      'settingDisableRenderRequestBody',
      'settingEncodeUrl',
      'settingFollowRedirects',
      'settingSendCookies',
      'settingStoreCookies',
    ]);
  });

  it('initializes correctly in read-only mode', async () => {
    const result = plugin.init(await models.request.getById('req_1'), CONTEXT, true);
    expect(Object.keys(result)).toEqual(['request']);
    expect(Object.keys(result.request).sort()).toEqual([
      'getAuthentication',
      'getBody',
      'getBodyText',
      'getEnvironment',
      'getEnvironmentVariable',
      'getHeader',
      'getHeaders',
      'getId',
      'getMethod',
      'getName',
      'getParameter',
      'getParameters',
      'getUrl',
      'hasHeader',
      'hasParameter',
    ]);
  });

  it('fails to initialize without request', () => {
    expect(() => plugin.init()).toThrowError('contexts.request initialized without request');
  });
});

describe('request.*', () => {
  beforeEach(async () => {
    await globalBeforeEach();
    await models.workspace.create({ _id: 'wrk_1', name: 'My Workspace' });
    await models.request.create({
      _id: 'req_1',
      parentId: 'wrk_1',
      name: 'My Request',
      body: { text: 'body' },
      authentication: { type: 'oauth2' },
      headers: [
        { name: 'hello', value: 'world' },
        { name: 'Content-Type', value: 'application/json' },
      ],
      parameters: [
        { name: 'foo', value: 'bar' },
        { name: 'message', value: 'Hello World!' },
      ],
    });
  });

  it('works for basic getters', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = plugin.init(await models.request.getById('req_1'), CONTEXT);
    expect(result.request.getId()).toBe('req_1');
    expect(result.request.getName()).toBe('My Request');
    expect(result.request.getUrl()).toBe('');
    expect(result.request.getMethod()).toBe('GET');
    expect(result.request.getBodyText()).toBe('body');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'request.getBodyText() is deprecated. Use request.getBody() instead.',
    );
    expect(result.request.getAuthentication()).toEqual({ type: 'oauth2' });
  });

  it('works for parameters', async () => {
    const result = plugin.init(await models.request.getById('req_1'), CONTEXT);

    // getParameters()
    expect(result.request.getParameters()).toEqual([
      { name: 'foo', value: 'bar' },
      { name: 'message', value: 'Hello World!' },
    ]);

    // getParameter()
    expect(result.request.getParameter('foo')).toBe('bar');
    expect(result.request.getParameter('FOO')).toBe(null);
    expect(result.request.getParameter('does-not-exist')).toBe(null);
    expect(result.request.hasParameter('foo')).toBe(true);

    // setHeader()
    result.request.setParameter('foo', 'baz');
    expect(result.request.getParameter('foo')).toBe('baz');

    // addHeader()
    result.request.addParameter('foo', 'another');
    result.request.addParameter('something-else', 'yet another');
    expect(result.request.getParameter('foo')).toBe('baz');
    expect(result.request.getParameter('something-else')).toBe('yet another');

    // removeHeader()
    result.request.removeParameter('foo');
    expect(result.request.getParameter('foo')).toBe(null);
    expect(result.request.hasParameter('foo')).toBe(false);
  });

  it('works for headers', async () => {
    const result = plugin.init(await models.request.getById('req_1'), CONTEXT);

    // getHeaders()
    expect(result.request.getHeaders()).toEqual([
      { name: 'hello', value: 'world' },
      { name: 'Content-Type', value: 'application/json' },
    ]);

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

    const result = plugin.init(request, CONTEXT);

    result.request.setCookie('foo', 'bar');
    result.request.setCookie('foo', 'baz');
    expect(request.cookies).toEqual([{ name: 'foo', value: 'baz' }]);
  });

  it('works for environment', async () => {
    const request = await models.request.getById('req_1');
    request.cookies = []; // Because the plugin technically needs a RenderedRequest

    const result = plugin.init(request, CONTEXT);

    // getEnvironment
    expect(result.request.getEnvironment()).toEqual({
      user_key: 'my_user_key',
      hello: 'world',
      array_test: ['a', 'b'],
      object_test: { a: 'A', b: 'B' },
      null_test: null,
    });

    // getEnvironmentVariable
    expect(result.request.getEnvironmentVariable('user_key')).toBe('my_user_key');
    expect(result.request.getEnvironmentVariable('hello')).toBe('world');
    expect(result.request.getEnvironmentVariable('array_test')).toEqual(['a', 'b']);
    expect(result.request.getEnvironmentVariable('object_test')).toEqual({
      a: 'A',
      b: 'B',
    });
    expect(result.request.getEnvironmentVariable('null_test')).toBe(null);
    expect(result.request.getEnvironmentVariable('bad')).toBeUndefined();
  });

  it('works for authentication', async () => {
    const request = await models.request.getById('req_1');
    request.authentication = {}; // Because the plugin technically needs a RenderedRequest

    const result = plugin.init(request, CONTEXT);

    result.request.setAuthenticationParameter('foo', 'bar');
    result.request.setAuthenticationParameter('foo', 'baz');
    expect(result.request.getAuthentication()).toEqual({ foo: 'baz' });
    expect(request.authentication).toEqual({ foo: 'baz' });
  });

  it('works for request body', async () => {
    const result = plugin.init(await models.request.getById('req_1'), CONTEXT);
    expect(result.request.getBody()).toEqual({ text: 'body' });
    const newBody = {
      mimeType: CONTENT_TYPE_FORM_URLENCODED,
      params: [
        {
          name: 'foo',
          value: 'bar',
        },
      ],
    };
    result.request.setBody(newBody);
    expect(result.request.getBody()).toEqual(newBody);
  });
});
