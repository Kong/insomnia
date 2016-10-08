import * as networkUtils from '../network';
import * as db from '../database';
import nock from 'nock';
import {getRenderedRequest} from '../render';

describe('buildRequestConfig()', () => {
  beforeEach(() => db.initDB({inMemoryOnly: true}, true));

  it('builds a default config', async () => {
    const workspace = await db.workspace.create();
    const request = Object.assign(db.request.init(), {
      parentId: workspace._id
    });

    const renderedRequest = await getRenderedRequest(request);
    const config = networkUtils._buildRequestConfig(renderedRequest);
    expect(config).toEqual({
      body: '',
      followAllRedirects: true,
      gzip: true,
      headers: {host: ''},
      maxRedirects: 20,
      method: 'GET',
      proxy: null,
      rejectUnauthorized: true,
      time: true,
      timeout: 0,
      url: 'http://'
    });
  });

  it('builds a complex config', async () => {
    const workspace = await db.workspace.create();
    const request = Object.assign(db.request.init(), {
      parentId: workspace._id,
      headers: [{host: '', name: 'Content-Type', value: 'application/json'}],
      parameters: [{name: 'foo bar', value: 'hello&world'}],
      method: 'POST',
      body: 'foo=bar',
      url: 'http://foo.com:3332/★/foo%20bar?bar=baz',
      authentication: {
        username: 'user',
        password: 'pass'
      }
    });

    const renderedRequest = await getRenderedRequest(request);
    const config = networkUtils._buildRequestConfig(renderedRequest);
    expect(config).toEqual({
      body: 'foo=bar',
      followAllRedirects: true,
      gzip: true,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic dXNlcjpwYXNz',
        'host': 'foo.com:3332'
      },
      maxRedirects: 20,
      method: 'POST',
      proxy: null,
      rejectUnauthorized: true,
      time: true,
      timeout: 0,
      url: 'http://foo.com:3332/%E2%98%85/foo%20bar?bar=baz&foo%20bar=hello%26world'
    })
  })
});

describe('actuallySend()', () => {
  beforeEach(() => db.initDB({inMemoryOnly: true}, true));

  it('does something', async () => {
    let mock;

    const workspace = await db.workspace.create();
    const settings = await db.settings.create();
    const cookies = [{
      creation: new Date('2016-10-05T04:40:49.505Z'),
      key: 'foo',
      value: 'barrrrr',
      expires: new Date('2096-10-12T04:40:49.000Z'),
      domain: 'notlocalhost',
      path: '/',
      hostOnly: true,
      lastAccessed: new Date('2096-10-05T04:40:49.505Z')
    }, {
      creation: new Date('2016-10-05T04:40:49.505Z'),
      key: 'foo',
      value: 'barrrrr',
      expires: new Date('2096-10-12T04:40:49.000Z'),
      domain: 'localhost',
      path: '/',
      hostOnly: true,
      lastAccessed: new Date('2096-10-05T04:40:49.505Z')
    }];

    await db.cookieJar.create({
      parentId: workspace._id,
      cookies
    });

    mock = nock('http://127.0.0.1')
      .matchHeader('Content-Type', 'application/json')
      .matchHeader('Authorization', 'Basic dXNlcjpwYXNz')
      .matchHeader('Cookie', 'foo=barrrrr')
      .post('/')
      .query({'foo bar': 'hello&world'})
      .reply(200, 'response body')
      .log(console.log);

    const request = Object.assign(db.request.init(), {
      _id: 'req_123',
      parentId: workspace._id,
      headers: [{name: 'Content-Type', value: 'application/json'}],
      parameters: [{name: 'foo bar', value: 'hello&world'}],
      method: 'POST',
      body: 'foo=bar',
      url: 'http://localhost',
      authentication: {
        username: 'user',
        password: 'pass'
      }
    });

    const renderedRequest = await getRenderedRequest(request);
    const response = await networkUtils._actuallySend(renderedRequest, settings);
    expect(mock.basePath).toBe('http://127.0.0.1:80');
    expect(response.url).toBe('http://localhost/?foo%20bar=hello%26world');
    expect(response.body).toBe('response body');
    expect(response.statusCode).toBe(200);
  });
});
