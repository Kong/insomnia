import * as templating from '../../index';
import * as models from '../../../models';
import {cookiesFromJar, jarFromCookies} from '../../../common/cookies';
import {getRenderContext} from '../../../common/render';

describe('RequestExtension cookie', async () => {
  beforeEach(global.insomniaBeforeEach);
  it('should get cookie by name', async () => {
    // Create necessary models
    const workspace = await models.workspace.create({name: 'Workspace'});
    const request = await models.request.create({
      parentId: workspace._id,
      url: 'https://insomnia.rest/foo/bar'
    });
    const cookieJar = await models.cookieJar.getOrCreateForWorkspace(workspace);
    const jar = jarFromCookies(cookieJar.cookies);
    jar.setCookieSync([
      'foo=bar',
      'path=/',
      'domain=.insomnia.rest',
      'HttpOnly Cache-Control: public, no-cache'
    ].join('; '), request.url);

    const cookies = await cookiesFromJar(jar);
    await models.cookieJar.update(cookieJar, {cookies});
    const context = await getRenderContext(request);
    const result = await templating.render(`{% request 'cookie', 'foo' %}`, {context});

    expect(result).toBe('bar');
  });
});

describe('RequestExtension url', async () => {
  beforeEach(global.insomniaBeforeEach);
  it('should get url', async () => {
    // Create necessary models
    const workspace = await models.workspace.create({name: 'Workspace'});
    const request = await models.request.create({
      parentId: workspace._id,
      url: 'https://insomnia.rest/foo/bar',
      parameters: [{name: 'foo', value: 'bar'}]
    });

    const context = await getRenderContext(request);
    const result = await templating.render(`{% request 'url' %}`, {context});

    expect(result).toBe('https://insomnia.rest/foo/bar?foo=bar');
  });

  it('should get rendered url', async () => {
    // Create necessary models
    const workspace = await models.workspace.create({name: 'Workspace'});
    const request = await models.request.create({
      parentId: workspace._id,
      url: 'https://insomnia.rest/foo/bar',
      parameters: [{name: 'foo', value: '{{ foo }}'}]
    });

    const context = await getRenderContext(request);
    context.foo = 'Hello World!';
    const result = await templating.render(`{% request 'url' %}`, {context});

    expect(result).toBe('https://insomnia.rest/foo/bar?foo=Hello%20World!');
  });
});

describe('RequestExtension header', async () => {
  beforeEach(global.insomniaBeforeEach);
  it('should get url', async () => {
    // Create necessary models
    const workspace = await models.workspace.create({name: 'Workspace'});
    const request = await models.request.create({
      parentId: workspace._id,
      url: 'https://insomnia.rest/foo/bar',
      headers: [{name: 'foo', value: '{{ foo }}'}]
    });

    const context = await getRenderContext(request);
    context.foo = 'Hello World!';
    const result = await templating.render(`{% request 'header', 'foo' %}`, {context});

    expect(result).toBe('Hello World!');
  });
});
