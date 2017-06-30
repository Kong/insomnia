import * as networkUtils from '../network';
import * as db from '../../common/database';
import {join as pathJoin, resolve as pathResolve} from 'path';
import {getRenderedRequest} from '../../common/render';
import * as models from '../../models';
import {AUTH_BASIC, CONTENT_TYPE_FILE, CONTENT_TYPE_FORM_DATA, CONTENT_TYPE_FORM_URLENCODED, getAppVersion} from '../../common/constants';

describe('actuallySend()', () => {
  beforeEach(() => db.init(models.types(), {inMemoryOnly: true}, true));

  it('sends a generic request', async () => {
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
      value: 'bar',
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
        type: AUTH_BASIC,
        username: 'user',
        password: 'pass'
      }
    });

    const renderedRequest = await getRenderedRequest(request);
    const {bodyBuffer} = await networkUtils._actuallySend(
      renderedRequest,
      workspace,
      settings
    );

    const body = JSON.parse(bodyBuffer);
    expect(body).toEqual({
      options: {
        COOKIELIST: [
          'notlocalhost\tFALSE\t/\tFALSE\t4000855249\tfoo\tbarrrrr',
          'localhost\tFALSE\t/\tFALSE\t4000855249\tfoo\tbar'
        ],
        CUSTOMREQUEST: 'POST',
        ACCEPT_ENCODING: '',
        COOKIEFILE: '',
        NOBODY: 0,
        FOLLOWLOCATION: true,
        HTTPHEADER: [
          'Content-Type: application/json',
          'Expect: ',
          'Transfer-Encoding: '
        ],
        NOPROGRESS: false,
        USERNAME: 'user',
        PASSWORD: 'pass',
        POSTFIELDS: 'foo=bar',
        PROXY: '',
        TIMEOUT_MS: 0,
        URL: 'http://localhost/?foo%20bar=hello%26world',
        USERAGENT: `insomnia/${getAppVersion()}`,
        VERBOSE: true
      }
    });
  });

  it('sends a urlencoded', async () => {
    const workspace = await models.workspace.create();
    const settings = await models.settings.create();
    const request = Object.assign(models.request.init(), {
      _id: 'req_123',
      parentId: workspace._id,
      headers: [{name: 'Content-Type', value: CONTENT_TYPE_FORM_URLENCODED}],
      method: 'POST',
      body: {
        mimeType: CONTENT_TYPE_FORM_URLENCODED,
        params: [
          {name: 'foo', value: 'bar'},
          {name: 'bar', value: ''},
          {name: '', value: 'value'}
        ]
      },
      url: 'http://localhost'
    });

    const renderedRequest = await getRenderedRequest(request);
    const {bodyBuffer} = await networkUtils._actuallySend(
      renderedRequest,
      workspace,
      settings
    );

    const body = JSON.parse(bodyBuffer);
    expect(body).toEqual({
      options: {
        CUSTOMREQUEST: 'POST',
        ACCEPT_ENCODING: '',
        COOKIEFILE: '',
        NOBODY: 0,
        FOLLOWLOCATION: true,
        HTTPHEADER: [
          'Content-Type: application/x-www-form-urlencoded',
          'Expect: ',
          'Transfer-Encoding: '
        ],
        NOPROGRESS: false,
        POSTFIELDS: 'foo=bar&bar=&=value',
        PROXY: '',
        TIMEOUT_MS: 0,
        URL: 'http://localhost/',
        USERAGENT: `insomnia/${getAppVersion()}`,
        VERBOSE: true
      }
    });
  });

  it('skips sending and storing cookies with setting', async () => {
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
        type: AUTH_BASIC,
        username: 'user',
        password: 'pass'
      },
      settingStoreCookies: false,
      settingSendCookies: false
    });

    const renderedRequest = await getRenderedRequest(request);
    const {bodyBuffer} = await networkUtils._actuallySend(
      renderedRequest,
      workspace,
      settings
    );

    const body = JSON.parse(bodyBuffer);
    expect(body).toEqual({
      options: {
        CUSTOMREQUEST: 'POST',
        ACCEPT_ENCODING: '',
        FOLLOWLOCATION: true,
        HTTPHEADER: [
          'Content-Type: application/json',
          'Expect: ',
          'Transfer-Encoding: '
        ],
        NOPROGRESS: false,
        USERNAME: 'user',
        PASSWORD: 'pass',
        POSTFIELDS: 'foo=bar',
        NOBODY: 0,
        PROXY: '',
        TIMEOUT_MS: 0,
        URL: 'http://localhost/?foo%20bar=hello%26world',
        USERAGENT: `insomnia/${getAppVersion()}`,
        VERBOSE: true
      }
    });
  });

  it('sends a file', async () => {
    const workspace = await models.workspace.create();
    const settings = await models.settings.create();
    await models.cookieJar.create({parentId: workspace._id});

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
    const {bodyBuffer} = await networkUtils._actuallySend(
      renderedRequest,
      workspace,
      settings
    );

    const body = JSON.parse(bodyBuffer);

    // READDATA is an fd (random int), so fuzzy assert this one
    expect(typeof body.options.READDATA).toBe('number');
    delete body.options.READDATA;

    expect(body).toEqual({
      options: {
        CUSTOMREQUEST: 'POST',
        ACCEPT_ENCODING: '',
        COOKIEFILE: '',
        FOLLOWLOCATION: true,
        HTTPHEADER: [
          'Content-Type: application/octet-stream',
          'Expect: ',
          'Transfer-Encoding: '
        ],
        NOPROGRESS: false,
        INFILESIZE: 13,
        PROXY: '',
        NOBODY: 0,
        TIMEOUT_MS: 0,
        UPLOAD: 1,
        URL: 'http://localhost/',
        USERAGENT: `insomnia/${getAppVersion()}`,
        VERBOSE: true
      }
    });
  });

  it('sends multipart form data', async () => {
    const workspace = await models.workspace.create();
    const settings = await models.settings.create();
    await models.cookieJar.create({parentId: workspace._id});
    const fileName = pathResolve(pathJoin(__dirname, './testfile.txt'));

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
          {name: 'baz', value: 'qux', disabled: true}
        ]
      }
    });

    const renderedRequest = await getRenderedRequest(request);
    const {bodyBuffer} = await networkUtils._actuallySend(
      renderedRequest,
      workspace,
      settings
    );
    const body = JSON.parse(bodyBuffer);
    expect(body).toEqual({
      options: {
        CUSTOMREQUEST: 'POST',
        ACCEPT_ENCODING: '',
        COOKIEFILE: '',
        FOLLOWLOCATION: true,
        HTTPHEADER: [
          'Content-Type: multipart/form-data',
          'Expect: ',
          'Transfer-Encoding: '
        ],
        HTTPPOST: [
          {file: fileName, name: 'foo', type: 'text/plain'},
          {contents: 'AA', name: 'a'}
        ],
        NOPROGRESS: false,
        PROXY: '',
        NOBODY: 0,
        TIMEOUT_MS: 0,
        URL: 'http://localhost/',
        USERAGENT: `insomnia/${getAppVersion()}`,
        VERBOSE: true
      }
    });
  });

  it('uses unix socket', async () => {
    const workspace = await models.workspace.create();
    const settings = await models.settings.create();

    const request = Object.assign(models.request.init(), {
      _id: 'req_123',
      parentId: workspace._id,
      url: 'http://unix:/my/socket:/my/path',
      method: 'GET'
    });

    const renderedRequest = await getRenderedRequest(request);
    const {bodyBuffer} = await networkUtils._actuallySend(renderedRequest, workspace, settings);
    // console.log('HELLO', response);

    const body = JSON.parse(bodyBuffer);
    expect(body).toEqual({
      options: {
        CUSTOMREQUEST: 'GET',
        ACCEPT_ENCODING: '',
        COOKIEFILE: '',
        FOLLOWLOCATION: true,
        HTTPHEADER: ['content-type: '],
        NOPROGRESS: false,
        PROXY: '',
        NOBODY: 0,
        TIMEOUT_MS: 0,
        URL: 'http://my/path',
        UNIX_SOCKET_PATH: '/my/socket',
        USERAGENT: `insomnia/${getAppVersion()}`,
        VERBOSE: true
      }
    });
  });

  it('uses works with "unix" host', async () => {
    const workspace = await models.workspace.create();
    const settings = await models.settings.create();

    const request = Object.assign(models.request.init(), {
      _id: 'req_123',
      parentId: workspace._id,
      url: 'http://unix:3000/my/path',
      method: 'GET'
    });

    const renderedRequest = await getRenderedRequest(request);
    const {bodyBuffer} = await networkUtils._actuallySend(renderedRequest, workspace, settings);
    // console.log('HELLO', response);

    const body = JSON.parse(bodyBuffer);
    expect(body).toEqual({
      options: {
        CUSTOMREQUEST: 'GET',
        ACCEPT_ENCODING: '',
        COOKIEFILE: '',
        FOLLOWLOCATION: true,
        HTTPHEADER: ['content-type: '],
        NOPROGRESS: false,
        PROXY: '',
        NOBODY: 0,
        TIMEOUT_MS: 0,
        URL: 'http://unix:3000/my/path',
        USERAGENT: `insomnia/${getAppVersion()}`,
        VERBOSE: true
      }
    });
  });
});
