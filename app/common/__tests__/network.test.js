import * as networkUtils from '../network';
import * as db from '../database';
import nock from 'nock';
import {resolve as pathResolve, join as pathJoin} from 'path';
import {getRenderedRequest} from '../render';
import * as models from '../../models';
import {CONTENT_TYPE_FORM_URLENCODED, getAppVersion} from '../constants';
import {CONTENT_TYPE_FILE} from '../constants';
import {CONTENT_TYPE_FORM_DATA} from '../constants';

describe('buildRequestConfig()', () => {
  beforeEach(() => db.init(models.types(), {inMemoryOnly: true}, true));

  it('builds a default config', async () => {
    const workspace = await models.workspace.create();
    const request = Object.assign(models.request.init(), {
      parentId: workspace._id
    });

    const renderedRequest = await getRenderedRequest(request);
    const config = networkUtils._buildRequestConfig(renderedRequest);
    expect(config).toEqual({
      body: '',
      encoding: null,
      followAllRedirects: true,
      followRedirect: true,
      forever: true,
      gzip: true,
      headers: {
        'Accept': '*/*',
        'User-Agent': `insomnia/${getAppVersion()}`
      },
      maxRedirects: 50,
      method: 'GET',
      proxy: null,
      rejectUnauthorized: true,
      time: true,
      timeout: 0,
      url: 'http://'
    });
  });

  it('builds a complex config', async () => {
    const workspace = await models.workspace.create();
    const request = Object.assign(models.request.init(), {
      parentId: workspace._id,
      headers: [
        {name: 'Content-Type', value: 'application/json', disabled: false},
        {name: 'hi', value: 'there', disabled: true},
        {name: 'x-hello', value: 'world'},
      ],
      parameters: [
        {name: 'foo bar', value: 'hello&world', disabled: false},
        {name: 'b', value: 'bb&world', disabled: true},
        {name: 'a', value: 'aa'},
      ],
      method: 'POST',
      body: {
        mimeType: CONTENT_TYPE_FORM_URLENCODED,
        params: [
          {name: 'X', value: 'XX', disabled: false},
          {name: 'Y', value: 'YY', disabled: true},
          {name: 'Z', value: 'ZZ'},
        ]
      },
      url: 'http://foo.com:3332/★/hi@gmail.com/foo%20bar?bar=baz',
      authentication: {
        disabled: false,
        username: 'user',
        password: 'pass'
      }
    });

    const renderedRequest = await getRenderedRequest(request);
    const config = networkUtils._buildRequestConfig(renderedRequest);
    expect(config).toEqual({
      body: 'X=XX&Z=ZZ',
      encoding: null,
      followAllRedirects: true,
      followRedirect: true,
      forever: true,
      gzip: true,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic dXNlcjpwYXNz',
        'Accept': '*/*',
        'User-Agent': `insomnia/${getAppVersion()}`,
        'x-hello': 'world'
      },
      maxRedirects: 50,
      method: 'POST',
      proxy: null,
      rejectUnauthorized: true,
      time: true,
      timeout: 0,
      url: 'http://foo.com:3332/%E2%98%85/hi@gmail.com/foo%20bar?bar=baz&foo%20bar=hello%26world&a=aa'
    })
  })
});

describe('actuallySend()', () => {
  beforeEach(() => db.init(models.types(), {inMemoryOnly: true}, true));

  it('does something', async () => {
    let mock;

    const workspace = await models.workspace.create();
    const settings = await models.settings.create();
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

    await models.cookieJar.create({
      parentId: workspace._id,
      cookies
    });

    mock = nock('http://localhost')
      .matchHeader('Content-Type', 'application/json')
      .matchHeader('Authorization', 'Basic dXNlcjpwYXNz')
      .matchHeader('Accept', '*/*')
      .matchHeader('User-Agent', `insomnia/${getAppVersion()}`)
      .matchHeader('Cookie', 'foo=barrrrr')
      .post('/', 'foo=bar')
      .query({'foo bar': 'hello&world'})
      .reply(200, 'response body')
      .log(console.log);

    const request = Object.assign(models.request.init(), {
      _id: 'req_123',
      parentId: workspace._id,
      headers: [{name: 'Content-Type', value: 'application/json'}],
      parameters: [{name: 'foo bar', value: 'hello&world'}],
      method: 'POST',
      body: {
        mimeType: CONTENT_TYPE_FORM_URLENCODED,
        params: [{name: 'foo', value: 'bar'}]
      },
      url: 'http://localhost',
      authentication: {
        username: 'user',
        password: 'pass'
      }
    });

    const renderedRequest = await getRenderedRequest(request);
    const response = await networkUtils._actuallySend(
      renderedRequest,
      workspace,
      settings
    );

    expect(mock.basePath).toBe('http://localhost:80');
    expect(response.error).toBe(undefined);
    expect(response.url).toBe('http://localhost/?foo%20bar=hello%26world');
    expect(response.body).toBe(new Buffer('response body').toString('base64'));
    expect(response.statusCode).toBe(200);
  });

  it('sends a file', async () => {
    let mock;

    const workspace = await models.workspace.create();
    const settings = await models.settings.create();
    await models.cookieJar.create({parentId: workspace._id});

    mock = nock('http://localhost')
      .matchHeader('Content-Type', 'application/octet-stream')
      .matchHeader('Accept', '*/*')
      .matchHeader('User-Agent', `insomnia/${getAppVersion()}`)
      .post('/', 'Hello World!')
      .reply(200, 'response body')
      .log(console.log);

    const request = Object.assign(models.request.init(), {
      _id: 'req_123',
      parentId: workspace._id,
      headers: [{name: 'Content-Type', value: 'application/octet-stream'}],
      url: 'http://localhost',
      method: 'POST',
      body: {
        mimeType: CONTENT_TYPE_FILE,
        fileName: pathResolve(pathJoin(__dirname, './testfile.txt')) // Let's send ourselves
      }
    });

    const renderedRequest = await getRenderedRequest(request);
    const response = await networkUtils._actuallySend(
      renderedRequest,
      workspace,
      settings
    );

    expect(mock.basePath).toBe('http://localhost:80');
    expect(response.error).toBe(undefined);
    expect(response.url).toBe('http://localhost/');
    expect(response.body).toBe(new Buffer('response body').toString('base64'));
    expect(response.statusCode).toBe(200);
  });

  it('sends multipart form data', async () => {
    let mock;

    const workspace = await models.workspace.create();
    const settings = await models.settings.create();
    await models.cookieJar.create({parentId: workspace._id});
    const fileName = pathResolve(pathJoin(__dirname, './testfile.txt'));
    let requestBody = 'n/a';
    mock = nock('http://localhost')
      .matchHeader('Content-Type', /^multipart\/form-data/)
      .matchHeader('Accept', '*/*')
      .matchHeader('User-Agent', `insomnia/${getAppVersion()}`)
      .post('/', body => {
        requestBody = body;
        return true;
      })
      .reply(200, 'response body')
      .log(console.log);

    const request = Object.assign(models.request.init(), {
      _id: 'req_123',
      parentId: workspace._id,
      headers: [{name: 'Content-Type', value: 'multipart/form-data'}],
      url: 'http://localhost',
      method: 'POST',
      body: {
        mimeType: CONTENT_TYPE_FORM_DATA,
        params: [
          // Should ignore value and send the file since type is set to file
          {name: 'foo', fileName: fileName, value: 'bar', type: 'file'},

          // Some extra params
          {name: 'a', value: 'AA'},
          {name: 'baz', value: 'qux', disabled: true},
        ]
      },
    });

    const renderedRequest = await getRenderedRequest(request);
    const response = await networkUtils._actuallySend(
      renderedRequest,
      workspace,
      settings
    );

    expect(mock.basePath).toBe('http://localhost:80');
    expect(response.error).toBe(undefined);
    expect(response.url).toBe('http://localhost/');
    expect(response.body).toBe(new Buffer('response body').toString('base64'));
    expect(response.statusCode).toBe(200);

    const lines = requestBody.split(/\r\n/);
    expect(lines.length).toBe(11);
    expect(lines[0]).toMatch(/^----------------------------\d{24}/);
    expect(lines[1]).toBe('Content-Disposition: form-data; name="foo"; filename="testfile.txt"');
    expect(lines[2]).toBe('Content-Type: text/plain');
    expect(lines[3]).toBe('');
    expect(lines[4]).toBe('Hello World!\n');
    expect(lines[5]).toMatch(/^----------------------------\d{24}/);
    expect(lines[6]).toBe('Content-Disposition: form-data; name="a"');
    expect(lines[7]).toBe('');
    expect(lines[8]).toBe('AA');
    expect(lines[9]).toMatch(/^----------------------------\d{24}--/);
    expect(lines[10]).toBe('');
  });
});
