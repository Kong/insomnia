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
    const response = await networkUtils._actuallySend(
      renderedRequest,
      workspace,
      settings
    );

    const body = JSON.parse(Buffer.from(response.body, 'base64'));
    expect(body).toEqual({
      options: {
        COOKIEFILE: '',
        COOKIELIST: [
          'notlocalhost\tTRUE\t/\tFALSE\t4000855249\tfoo\tbarrrrr',
          'localhost\tTRUE\t/\tFALSE\t4000855249\tfoo\tbar'
        ],
        CUSTOMREQUEST: 'POST',
        ENCODING: '',
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
    const response = await networkUtils._actuallySend(
      renderedRequest,
      workspace,
      settings
    );

    const body = JSON.parse(Buffer.from(response.body, 'base64'));
    expect(body).toEqual({
      options: {
        COOKIEFILE: '',
        CUSTOMREQUEST: 'POST',
        ENCODING: '',
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
    const response = await networkUtils._actuallySend(
      renderedRequest,
      workspace,
      settings
    );

    const body = JSON.parse(Buffer.from(response.body, 'base64'));

    // READDATA is an fd (random int), so fuzzy assert this one
    expect(typeof body.options.READDATA).toBe('number');
    delete body.options.READDATA;

    expect(body).toEqual({
      options: {
        COOKIEFILE: '',
        CUSTOMREQUEST: 'POST',
        ENCODING: '',
        FOLLOWLOCATION: true,
        HTTPHEADER: [
          'Content-Type: application/octet-stream',
          'Content-Length: 13',
          'Expect: ',
          'Transfer-Encoding: '
        ],
        NOPROGRESS: false,
        PROXY: '',
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
    const response = await networkUtils._actuallySend(
      renderedRequest,
      workspace,
      settings
    );

    const body = JSON.parse(Buffer.from(response.body, 'base64'));
    expect(body).toEqual({
      options: {
        COOKIEFILE: '',
        CUSTOMREQUEST: 'POST',
        ENCODING: '',
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
        TIMEOUT_MS: 0,
        URL: 'http://localhost/',
        USERAGENT: `insomnia/${getAppVersion()}`,
        VERBOSE: true
      }
    });
  });
});
