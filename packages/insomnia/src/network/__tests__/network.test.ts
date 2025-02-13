import { CurlHttpVersion, CurlNetrc } from '@getinsomnia/node-libcurl';
import fs from 'fs';
import { join as pathJoin, resolve as pathResolve } from 'path';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  AUTH_AWS_IAM,
  AUTH_BASIC,
  AUTH_NETRC,
  CONTENT_TYPE_FILE,
  CONTENT_TYPE_FORM_DATA,
  CONTENT_TYPE_FORM_URLENCODED,
} from '../../common/constants';
import { filterHeaders } from '../../common/misc';
import { getRenderedRequestAndContext } from '../../common/render';
import { HttpVersions } from '../../common/settings';
import { _parseHeaders, getHttpVersion } from '../../main/network/libcurl-promise';
import { DEFAULT_BOUNDARY } from '../../main/network/multipart';
import { _getAwsAuthHeaders } from '../../main/network/parse-header-strings';
import * as models from '../../models';
import * as networkUtils from '../network';
import { getSetCookiesFromResponseHeaders } from '../network';

const getRenderedRequest = async (args: Parameters<typeof getRenderedRequestAndContext>[0]) => (await getRenderedRequestAndContext(args)).request;

describe('sendCurlAndWriteTimeline()', () => {
  beforeEach(async () => {
    await models.project.all();
  });

  it('sends a generic request', async () => {
    const workspace = await models.workspace.create();
    const settings = await models.settings.getOrCreate();
    const cookies = [
      {
        creation: new Date('2016-10-05T04:40:49.505Z'),
        key: 'foo',
        value: 'barrrrr',
        expires: new Date('2096-10-12T04:40:49.000Z'),
        domain: 'notlocalhost',
        path: '/',
        hostOnly: true,
        lastAccessed: new Date('2096-10-05T04:40:49.505Z'),
      },
      {
        creation: new Date('2016-10-05T04:40:49.505Z'),
        key: 'foo',
        value: 'bar',
        expires: new Date('2096-10-12T04:40:49.000Z'),
        domain: 'localhost',
        path: '/',
        hostOnly: true,
        lastAccessed: new Date('2096-10-05T04:40:49.505Z'),
      },
    ];
    const cookieJar = await models.cookieJar.getOrCreateForParentId(workspace._id);
    await models.cookieJar.update(cookieJar, {
      parentId: workspace._id,
      cookies,
    });
    const request = Object.assign(models.request.init(), {
      _id: 'req_123',
      parentId: workspace._id,
      headers: [
        {
          name: 'Content-Type',
          value: 'application/json',
        },
        {
          name: 'Empty',
          value: '',
        },
      ],
      parameters: [
        {
          name: 'foo bar',
          value: 'hello&world',
        },
      ],
      method: 'POST',
      body: {
        mimeType: CONTENT_TYPE_FORM_URLENCODED,
        params: [
          {
            name: 'foo',
            value: 'bar',
          },
        ],
      },
      url: 'http://localhost',
      authentication: {
        type: AUTH_BASIC,
        username: 'user',
        password: 'pass',
      },
    });
    const renderedRequest = await getRenderedRequest({ request });
    const response = await networkUtils.sendCurlAndWriteTimeline(
      renderedRequest,
      [],
      null,
      settings,
      '/tmp/res_id',
      'res_id'
    );
    const bodyBuffer = models.response.getBodyBuffer(response);
    const body = JSON.parse(String(bodyBuffer));
    expect(body).toEqual({
      meta: {},
      features: {
        Raw: true,
      },
      options: {
        COOKIELIST: [
          'notlocalhost\tFALSE\t/\tFALSE\t4000855249\tfoo\tbarrrrr',
          'localhost\tFALSE\t/\tFALSE\t4000855249\tfoo\tbar',
        ],
        ACCEPT_ENCODING: '',
        COOKIEFILE: '',
        FOLLOWLOCATION: true,
        HTTPHEADER: [
          'Content-Type: application/json',
          'Empty;',
          'Expect:',
          'Transfer-Encoding:',
          'Authorization: Basic dXNlcjpwYXNz',
          'Accept: */*',
          'Accept-Encoding:',
        ],
        MAXREDIRS: 10,
        NOPROGRESS: true,
        POSTFIELDS: 'foo=bar',
        POST: 1,
        PROXY: '',
        TIMEOUT_MS: 30000,
        URL: 'http://localhost/?foo%20bar=hello%26world',
        USERAGENT: '',
        VERBOSE: true,
        SSL_OPTIONS: 'NativeCa',
      },
    });
  });

  it('sends a urlencoded', async () => {
    const workspace = await models.workspace.create();
    const settings = await models.settings.getOrCreate();
    const request = Object.assign(models.request.init(), {
      _id: 'req_123',
      parentId: workspace._id,
      headers: [
        {
          name: 'Content-Type',
          value: CONTENT_TYPE_FORM_URLENCODED,
        },
      ],
      method: 'POST',
      body: {
        mimeType: CONTENT_TYPE_FORM_URLENCODED,
        params: [
          {
            name: 'foo',
            value: 'bar',
          },
          {
            name: 'bar',
            value: '',
          },
          {
            name: '',
            value: 'value',
          },
        ],
      },
      url: 'http://localhost',
    });
    const renderedRequest = await getRenderedRequest({ request });
    const response = await networkUtils.sendCurlAndWriteTimeline(
      renderedRequest,
      [],
      null,
      settings,
      '/tmp/res_id',
      'res_id'
    );
    const bodyBuffer = models.response.getBodyBuffer(response);
    const body = JSON.parse(String(bodyBuffer));
    expect(body).toEqual({
      meta: {},
      features: {
        Raw: true,
      },
      options: {
        POST: 1,
        ACCEPT_ENCODING: '',
        COOKIEFILE: '',
        FOLLOWLOCATION: true,
        HTTPHEADER: [
          'Content-Type: application/x-www-form-urlencoded',
          'Expect:',
          'Transfer-Encoding:',
          'Accept: */*',
          'Accept-Encoding:',
        ],
        MAXREDIRS: 10,
        NOPROGRESS: true,
        POSTFIELDS: 'foo=bar&bar=&=value',
        PROXY: '',
        TIMEOUT_MS: 30000,
        URL: 'http://localhost/',
        USERAGENT: '',
        VERBOSE: true,
        SSL_OPTIONS: 'NativeCa',
     },
    });
  });

  it('skips sending and storing cookies with setting', async () => {
    const workspace = await models.workspace.create();
    const settings = await models.settings.getOrCreate();
    const cookies = [
      {
        creation: new Date('2016-10-05T04:40:49.505Z'),
        key: 'foo',
        value: 'barrrrr',
        expires: new Date('2096-10-12T04:40:49.000Z'),
        domain: 'notlocalhost',
        path: '/',
        hostOnly: true,
        lastAccessed: new Date('2096-10-05T04:40:49.505Z'),
      },
      {
        creation: new Date('2016-10-05T04:40:49.505Z'),
        key: 'foo',
        value: 'barrrrr',
        expires: new Date('2096-10-12T04:40:49.000Z'),
        domain: 'localhost',
        path: '/',
        hostOnly: true,
        lastAccessed: new Date('2096-10-05T04:40:49.505Z'),
      },
    ];
    await models.cookieJar.create({
      parentId: workspace._id,
      cookies,
    });
    const request = Object.assign(models.request.init(), {
      _id: 'req_123',
      parentId: workspace._id,
      headers: [
        {
          name: 'Content-Type',
          value: 'application/json',
        },
      ],
      parameters: [
        {
          name: 'foo bar',
          value: 'hello&world',
        },
      ],
      method: 'GET',
      body: {
        mimeType: CONTENT_TYPE_FORM_URLENCODED,
        params: [
          {
            name: 'foo',
            value: 'bar',
          },
        ],
      },
      url: 'http://localhost',
      authentication: {
        type: AUTH_BASIC,
        username: 'user',
        password: 'pass',
      },
      settingStoreCookies: false,
      settingSendCookies: false,
    });
    const renderedRequest = await getRenderedRequest({ request });
    const response = await networkUtils.sendCurlAndWriteTimeline(
      renderedRequest,
      [],
      null,
      settings,
      '/tmp/res_id',
      'res_id'
    );
    const bodyBuffer = models.response.getBodyBuffer(response);
    const body = JSON.parse(String(bodyBuffer));
    expect(body).toEqual({
      meta: {},
      features: {
        Raw: true,
      },
      options: {
        CUSTOMREQUEST: 'GET',
        ACCEPT_ENCODING: '',
        FOLLOWLOCATION: true,
        HTTPHEADER: [
          'Content-Type: application/json',
          'Expect:',
          'Transfer-Encoding:',
          'Authorization: Basic dXNlcjpwYXNz',
          'Accept: */*',
          'Accept-Encoding:',
        ],
        MAXREDIRS: 10,
        NOPROGRESS: true,
        POSTFIELDS: 'foo=bar',
        PROXY: '',
        TIMEOUT_MS: 30000,
        URL: 'http://localhost/?foo%20bar=hello%26world',
        USERAGENT: '',
        VERBOSE: true,
        SSL_OPTIONS: 'NativeCa',
      },
    });
  });

  it('sends a file', async () => {
    const workspace = await models.workspace.create();
    const settings = await models.settings.getOrCreate();
    await models.cookieJar.create({
      parentId: workspace._id,
    });
    const fileName = pathResolve(pathJoin(__dirname, './testfile.txt'));
    const request = Object.assign(models.request.init(), {
      _id: 'req_123',
      parentId: workspace._id,
      headers: [
        {
          name: 'Content-Type',
          value: 'application/octet-stream',
        },
      ],
      url: 'http://localhost',
      method: 'POST',
      body: {
        mimeType: CONTENT_TYPE_FILE,
        fileName,
      },
    });
    const renderedRequest = await getRenderedRequest({ request });
    const response = await networkUtils.sendCurlAndWriteTimeline(
      renderedRequest,
      [],
      null,
      settings,
      '/tmp/res_id',
      'res_id'
    );
    const bodyBuffer = models.response.getBodyBuffer(response);
    const body = JSON.parse(String(bodyBuffer));
    expect(body).toEqual({
      meta: {},
      features: {
        Raw: true,
      },
      options: {
        POST: 1,
        ACCEPT_ENCODING: '',
        CUSTOMREQUEST: 'POST',
        COOKIEFILE: '',
        FOLLOWLOCATION: true,
        HTTPHEADER: [
          'Content-Type: application/octet-stream',
          'Expect:',
          'Transfer-Encoding:',
          'Accept: */*',
          'Accept-Encoding:',
        ],
        MAXREDIRS: 10,
        NOPROGRESS: true,
        INFILESIZE_LARGE: 26,
        PROXY: '',
        READDATA: fs.readFileSync(fileName, 'utf8'),
        TIMEOUT_MS: 30000,
        UPLOAD: 1,
        URL: 'http://localhost/',
        USERAGENT: '',
        VERBOSE: true,
        SSL_OPTIONS: 'NativeCa',
      },
    });
  });

  it('sends multipart form data', async () => {
    const workspace = await models.workspace.create();
    const settings = await models.settings.getOrCreate();
    await models.cookieJar.create({
      parentId: workspace._id,
    });
    const fileName = pathResolve(pathJoin(__dirname, './testfile.txt'));
    const request = Object.assign(models.request.init(), {
      _id: 'req_123',
      parentId: workspace._id,
      headers: [
        {
          name: 'Content-Type',
          value: 'multipart/form-data',
        },
      ],
      url: 'http://localhost',
      method: 'POST',
      body: {
        mimeType: CONTENT_TYPE_FORM_DATA,
        params: [
          // Should ignore value and send the file since type is set to file
          {
            name: 'foo',
            fileName: fileName,
            value: 'bar',
            type: 'file',
          }, // Some extra params
          {
            name: 'a',
            value: 'AA',
          },
          {
            name: 'baz',
            value: 'qux',
            disabled: true,
          },
        ],
      },
    });
    const renderedRequest = await getRenderedRequest({ request });
    const response = await networkUtils.sendCurlAndWriteTimeline(
      renderedRequest,
      [],
      null,
      settings,
      '/tmp/res_id',
      'res_id'
    );
    const bodyBuffer = models.response.getBodyBuffer(response);
    const body = JSON.parse(String(bodyBuffer));
    expect(body).toEqual({
      meta: {},
      features: {
        Raw: true,
      },
      options: {
        POST: 1,
        ACCEPT_ENCODING: '',
        COOKIEFILE: '',
        FOLLOWLOCATION: true,
        CUSTOMREQUEST: 'POST',
        HTTPHEADER: [
          'Content-Type: multipart/form-data; boundary=X-INSOMNIA-BOUNDARY',
          'Expect:',
          'Transfer-Encoding:',
          'Accept: */*',
          'Accept-Encoding:',
        ],
        INFILESIZE_LARGE: 244,
        MAXREDIRS: 10,
        NOPROGRESS: true,
        READDATA: [
          `--${DEFAULT_BOUNDARY}`,
          'Content-Disposition: form-data; name="foo"; filename="testfile.txt"',
          'Content-Type: text/plain',
          '',
          fs.readFileSync(fileName),
          `--${DEFAULT_BOUNDARY}`,
          'Content-Disposition: form-data; name="a"',
          '',
          'AA',
          `--${DEFAULT_BOUNDARY}--`,
          '',
        ].join('\r\n'),
        PROXY: '',
        TIMEOUT_MS: 30000,
        URL: 'http://localhost/',
        UPLOAD: 1,
        USERAGENT: '',
        VERBOSE: true,
        SSL_OPTIONS: 'NativeCa',
      },
    });
  });

  it('uses unix socket', async () => {
    const workspace = await models.workspace.create();
    const settings = await models.settings.getOrCreate();
    const request = Object.assign(models.request.init(), {
      _id: 'req_123',
      parentId: workspace._id,
      url: 'http://unix:/my/socket:/my/path',
      method: 'GET',
    });
    const renderedRequest = await getRenderedRequest({ request });
    const response = await networkUtils.sendCurlAndWriteTimeline(
      renderedRequest,
      [],
      null,
      settings,
      '/tmp/res_id',
      'res_id'
    );
    const bodyBuffer = models.response.getBodyBuffer(response);
    const body = JSON.parse(String(bodyBuffer));
    expect(body).toEqual({
      meta: {},
      features: {
        Raw: true,
      },
      options: {
        CUSTOMREQUEST: 'GET',
        ACCEPT_ENCODING: '',
        COOKIEFILE: '',
        FOLLOWLOCATION: true,
        HTTPHEADER: ['Accept: */*', 'Accept-Encoding:', 'content-type:'],
        MAXREDIRS: 10,
        NOPROGRESS: true,
        PROXY: '',
        TIMEOUT_MS: 30000,
        URL: 'http://my/path',
        UNIX_SOCKET_PATH: '/my/socket',
        USERAGENT: '',
        VERBOSE: true,
        SSL_OPTIONS: 'NativeCa',
      },
    });
  });

  it('uses works with HEAD', async () => {
    const workspace = await models.workspace.create();
    const settings = await models.settings.getOrCreate();
    const request = Object.assign(models.request.init(), {
      _id: 'req_123',
      parentId: workspace._id,
      url: 'http://localhost:3000/foo/bar',
      method: 'HEAD',
    });
    const renderedRequest = await getRenderedRequest({ request });
    const response = await networkUtils.sendCurlAndWriteTimeline(
      renderedRequest,
      [],
      null,
      settings,
      '/tmp/res_id',
      'res_id'
    );
    const bodyBuffer = models.response.getBodyBuffer(response);
    const body = JSON.parse(String(bodyBuffer));
    expect(body).toEqual({
      meta: {},
      features: {
        Raw: true,
      },
      options: {
        NOBODY: 1,
        ACCEPT_ENCODING: '',
        COOKIEFILE: '',
        FOLLOWLOCATION: true,
        HTTPHEADER: ['Accept: */*', 'Accept-Encoding:', 'content-type:'],
        MAXREDIRS: 10,
        NOPROGRESS: true,
        PROXY: '',
        TIMEOUT_MS: 30000,
        URL: 'http://localhost:3000/foo/bar',
        USERAGENT: '',
        VERBOSE: true,
        SSL_OPTIONS: 'NativeCa',
      },
    });
  });

  it('uses works with "unix" host', async () => {
    const workspace = await models.workspace.create();
    const settings = await models.settings.getOrCreate();
    const request = Object.assign(models.request.init(), {
      _id: 'req_123',
      parentId: workspace._id,
      url: 'http://unix:3000/my/path',
      method: 'GET',
    });
    const renderedRequest = await getRenderedRequest({ request });
    const response = await networkUtils.sendCurlAndWriteTimeline(
      renderedRequest,
      [],
      null,
      settings,
      '/tmp/res_id',
      'res_id'
    );
    const bodyBuffer = models.response.getBodyBuffer(response);
    const body = JSON.parse(String(bodyBuffer));
    expect(body).toEqual({
      meta: {},
      features: {
        Raw: true,
      },
      options: {
        CUSTOMREQUEST: 'GET',
        ACCEPT_ENCODING: '',
        COOKIEFILE: '',
        FOLLOWLOCATION: true,
        HTTPHEADER: ['Accept: */*', 'Accept-Encoding:', 'content-type:'],
        MAXREDIRS: 10,
        NOPROGRESS: true,
        PROXY: '',
        TIMEOUT_MS: 30000,
        URL: 'http://unix:3000/my/path',
        USERAGENT: '',
        VERBOSE: true,
        SSL_OPTIONS: 'NativeCa',
      },
    });
  });

  it('uses netrc', async () => {
    const workspace = await models.workspace.create();
    const settings = await models.settings.getOrCreate();
    const request = Object.assign(models.request.init(), {
      _id: 'req_123',
      parentId: workspace._id,
      authentication: {
        type: AUTH_NETRC,
      },
    });
    const renderedRequest = await getRenderedRequest({ request });
    const response = await networkUtils.sendCurlAndWriteTimeline(
      renderedRequest,
      [],
      null,
      settings,
      '/tmp/res_id',
      'res_id'
    );
    const bodyBuffer = models.response.getBodyBuffer(response);
    const body = JSON.parse(String(bodyBuffer));
    expect(body).toEqual({
      meta: {},
      features: {
        Raw: true,
      },
      options: {
        CUSTOMREQUEST: 'GET',
        ACCEPT_ENCODING: '',
        COOKIEFILE: '',
        FOLLOWLOCATION: true,
        HTTPHEADER: ['Accept: */*', 'Accept-Encoding:', 'content-type:'],
        MAXREDIRS: 10,
        NOPROGRESS: true,
        PROXY: '',
        TIMEOUT_MS: 30000,
        NETRC: CurlNetrc.Required,
        URL: '',
        USERAGENT: '',
        VERBOSE: true,
        SSL_OPTIONS: 'NativeCa',
      },
    });
  });

  it('disables ssl verification when configured to do so', async () => {
    if (process.platform === 'darwin') {
      // skipped this test, due to SSL_VERIFYHOST being disabled for MacOS on libcurl-promise.ts
      return;
    }
    const workspace = await models.workspace.create();
    const settings = await models.settings.getOrCreate();
    const cookies = [
      {
        creation: new Date('2016-10-05T04:40:49.505Z'),
        key: 'foo',
        value: 'barrrrr',
        expires: new Date('2096-10-12T04:40:49.000Z'),
        domain: 'notlocalhost',
        path: '/',
        hostOnly: true,
        lastAccessed: new Date('2096-10-05T04:40:49.505Z'),
      },
      {
        creation: new Date('2016-10-05T04:40:49.505Z'),
        key: 'foo',
        value: 'bar',
        expires: new Date('2096-10-12T04:40:49.000Z'),
        domain: 'localhost',
        path: '/',
        hostOnly: true,
        lastAccessed: new Date('2096-10-05T04:40:49.505Z'),
      },
    ];
    const cookieJar = await models.cookieJar.getOrCreateForParentId(workspace._id);
    await models.cookieJar.update(cookieJar, {
      parentId: workspace._id,
      cookies,
    });
    const request = Object.assign(models.request.init(), {
      _id: 'req_123',
      parentId: workspace._id,
      headers: [
        {
          name: 'Content-Type',
          value: 'application/json',
        },
        {
          name: 'Empty',
          value: '',
        },
      ],
      parameters: [
        {
          name: 'foo bar',
          value: 'hello&world',
        },
      ],
      method: 'POST',
      body: {
        mimeType: CONTENT_TYPE_FORM_URLENCODED,
        params: [
          {
            name: 'foo',
            value: 'bar',
          },
        ],
      },
      url: 'http://localhost',
      authentication: {
        type: AUTH_BASIC,
        username: 'user',
        password: 'pass',
      },
    });
    const renderedRequest = await getRenderedRequest({ request });
    const response = await networkUtils.sendCurlAndWriteTimeline(
      renderedRequest,
      [],
      null,
      { ...settings, validateSSL: false },
      '/tmp/res_id',
      'res_id'
    );
    const bodyBuffer = models.response.getBodyBuffer(response);
    const body = JSON.parse(String(bodyBuffer));
    expect(body).toEqual({
      meta: {},
      features: {
        Raw: true,
      },
      options: {
        COOKIELIST: [
          'notlocalhost\tFALSE\t/\tFALSE\t4000855249\tfoo\tbarrrrr',
          'localhost\tFALSE\t/\tFALSE\t4000855249\tfoo\tbar',
        ],
        ACCEPT_ENCODING: '',
        COOKIEFILE: '',
        FOLLOWLOCATION: true,
        HTTPHEADER: [
          'Content-Type: application/json',
          'Empty;',
          'Expect:',
          'Transfer-Encoding:',
          'Authorization: Basic dXNlcjpwYXNz',
          'Accept: */*',
          'Accept-Encoding:',
        ],
        MAXREDIRS: 10,
        NOPROGRESS: true,
        POSTFIELDS: 'foo=bar',
        POST: 1,
        PROXY: '',
        SSL_VERIFYHOST: 0, // should disable SSL
        SSL_VERIFYPEER: 0, // should disable SSL
        TIMEOUT_MS: 30000,
        URL: 'http://localhost/?foo%20bar=hello%26world',
        USERAGENT: '',
        VERBOSE: true,
        SSL_OPTIONS: 'NativeCa',
      },
    });
  });

  it('sets HTTP version', async () => {
    const workspace = await models.workspace.create();
    const settings = await models.settings.getOrCreate();
    const request = Object.assign(models.request.init(), {
      _id: 'req_123',
      parentId: workspace._id,
    });
    const renderedRequest = await getRenderedRequest({ request });
    const responseV1 = await networkUtils.sendCurlAndWriteTimeline(renderedRequest, [], null, {
      ...settings,
      preferredHttpVersion: HttpVersions.V1_0,
    },
      '/tmp/res_id',
      'res_id'
    );
    expect(JSON.parse(String(models.response.getBodyBuffer(responseV1))).options.HTTP_VERSION).toBe('V1_0');
    expect(getHttpVersion(HttpVersions.V1_0).curlHttpVersion).toBe(CurlHttpVersion.V1_0);
    expect(getHttpVersion(HttpVersions.V1_1).curlHttpVersion).toBe(CurlHttpVersion.V1_1);
    expect(getHttpVersion(HttpVersions.V2PriorKnowledge).curlHttpVersion).toBe(CurlHttpVersion.V2PriorKnowledge);
    expect(getHttpVersion(HttpVersions.V2_0).curlHttpVersion).toBe(CurlHttpVersion.V2_0);
    expect(getHttpVersion(HttpVersions.v3).curlHttpVersion).toBe(CurlHttpVersion.v3);
    expect(getHttpVersion(HttpVersions.default).curlHttpVersion).toBe(undefined);
    expect(getHttpVersion('blah').curlHttpVersion).toBe(undefined);
  });
});

describe('_getAwsAuthHeaders', () => {
  it('should generate expected headers', () => {
    const authentication = {
      type: AUTH_AWS_IAM,
      accessKeyId: 'AKIA99999999',
      secretAccessKey: 'SAK9999999999999',
      sessionToken: 'ST99999999999999',
      region: 'us-west-2',
      service: 'ec2',
    };

    const headers = _getAwsAuthHeaders({
      authentication,
      url: 'https://ec2.us-west-2.amazonaws.com/path?query=q1',
      method: 'POST',
      contentTypeHeader: 'application/json',
      body: '{}',
    });

    expect(filterHeaders(headers, 'x-amz-date')[0].value).toMatch(/^\d{8}T\d{6}Z$/);
    expect(filterHeaders(headers, 'host')[0].value).toEqual('ec2.us-west-2.amazonaws.com');
    expect(filterHeaders(headers, 'authorization')[0].value).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIA99999999\/\d{8}\/us-west-2\/ec2\/aws4_request, SignedHeaders=content-length;content-type;host;x-amz-date;x-amz-security-token, Signature=[a-z0-9]*$/,
    );
    expect(filterHeaders(headers, 'content-type')).toEqual([]);
  });

  it('should handle sparse request', () => {
    const authentication = {
      type: AUTH_AWS_IAM,
      accessKeyId: 'AKIA99999999',
      secretAccessKey: 'SAK9999999999999',
      sessionToken: 'ST99999999999999',
      region: 'us-west-2',
      service: 'ec2',
    };

    const headers = _getAwsAuthHeaders({
      authentication,
      url: 'https://example.com',
      method: 'GET',
    });
    expect(filterHeaders(headers, 'x-amz-date')[0].value).toMatch(/^\d{8}T\d{6}Z$/);
    expect(filterHeaders(headers, 'host')[0].value).toEqual('example.com');
    expect(filterHeaders(headers, 'authorization')[0].value).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIA99999999\/\d{8}\/us-west-2\/ec2\/aws4_request, SignedHeaders=host;x-amz-date;x-amz-security-token, Signature=[a-z0-9]*$/,
    );
    expect(filterHeaders(headers, 'content-type')).toEqual([]);
  });
});

describe('_parseHeaders', () => {
  const basicHeaders = [
    'HTTP/1.1 301 Moved Permanently',
    'X-Powered-By: Express',
    'location: http://localhost:3000/',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Length: 17',
    'ETag: W/"11-WKzg6oYof0o8Mliwrz5pkw"',
    'Duplicate: foo',
    'Duplicate: bar',
    'Date: Mon, 13 Nov 2017 22:06:28 GMT',
    'Foo', // Invalid header
    '',
  ];
  const minimalHeaders = ['HTTP/1.1 301', ''];

  it('Parses single response headers', () => {
    expect(_parseHeaders(Buffer.from(basicHeaders.join('\n')))).toEqual([
      {
        code: 301,
        version: 'HTTP/1.1',
        reason: 'Moved Permanently',
        headers: [
          {
            name: 'X-Powered-By',
            value: 'Express',
          },
          {
            name: 'location',
            value: 'http://localhost:3000/',
          },
          {
            name: 'Content-Type',
            value: 'text/plain; charset=utf-8',
          },
          {
            name: 'Content-Length',
            value: '17',
          },
          {
            name: 'ETag',
            value: 'W/"11-WKzg6oYof0o8Mliwrz5pkw"',
          },
          {
            name: 'Duplicate',
            value: 'foo',
          },
          {
            name: 'Duplicate',
            value: 'bar',
          },
          {
            name: 'Date',
            value: 'Mon, 13 Nov 2017 22:06:28 GMT',
          },
          {
            name: 'Foo',
            value: '',
          },
        ],
      },
    ]);
  });

  it('Parses Windows newlines', () => {
    expect(_parseHeaders(Buffer.from(basicHeaders.join('\r\n')))).toEqual([
      {
        code: 301,
        version: 'HTTP/1.1',
        reason: 'Moved Permanently',
        headers: [
          {
            name: 'X-Powered-By',
            value: 'Express',
          },
          {
            name: 'location',
            value: 'http://localhost:3000/',
          },
          {
            name: 'Content-Type',
            value: 'text/plain; charset=utf-8',
          },
          {
            name: 'Content-Length',
            value: '17',
          },
          {
            name: 'ETag',
            value: 'W/"11-WKzg6oYof0o8Mliwrz5pkw"',
          },
          {
            name: 'Duplicate',
            value: 'foo',
          },
          {
            name: 'Duplicate',
            value: 'bar',
          },
          {
            name: 'Date',
            value: 'Mon, 13 Nov 2017 22:06:28 GMT',
          },
          {
            name: 'Foo',
            value: '',
          },
        ],
      },
    ]);
  });

  it('Parses multiple responses', () => {
    const blobs = basicHeaders.join('\r\n') + '\n' + minimalHeaders.join('\n');
    expect(_parseHeaders(Buffer.from(blobs))).toEqual([
      {
        code: 301,
        version: 'HTTP/1.1',
        reason: 'Moved Permanently',
        headers: [
          {
            name: 'X-Powered-By',
            value: 'Express',
          },
          {
            name: 'location',
            value: 'http://localhost:3000/',
          },
          {
            name: 'Content-Type',
            value: 'text/plain; charset=utf-8',
          },
          {
            name: 'Content-Length',
            value: '17',
          },
          {
            name: 'ETag',
            value: 'W/"11-WKzg6oYof0o8Mliwrz5pkw"',
          },
          {
            name: 'Duplicate',
            value: 'foo',
          },
          {
            name: 'Duplicate',
            value: 'bar',
          },
          {
            name: 'Date',
            value: 'Mon, 13 Nov 2017 22:06:28 GMT',
          },
          {
            name: 'Foo',
            value: '',
          },
        ],
      },
      {
        code: 301,
        headers: [],
        reason: '',
        version: 'HTTP/1.1',
      },
    ]);
  });
});

describe('getSetCookiesFromResponseHeaders', () => {
  it('defaults to empty array', () => {
    const headers = [];
    expect(getSetCookiesFromResponseHeaders(headers)).toEqual([]);
  });
  it('gets set-cookies', () => {
    const headers = [{ name: 'Set-Cookie', value: 'monster' }];
    expect(getSetCookiesFromResponseHeaders(headers)).toEqual(['monster']);
  });
  it('gets two case-insenstive set-cookies', () => {
    const headers = [{ name: 'Set-Cookie', value: 'monster' }, { name: 'set-cookie', value: 'mash' }];
    expect(getSetCookiesFromResponseHeaders(headers)).toEqual(['monster', 'mash']);
  });
});
describe('getCurrentUrl for tough-cookie', () => {
  it('defaults to finalUrl', () => {
    const headerResults = [];
    const finalUrl = 'http://mergemyshit.dev';
    expect(networkUtils.getCurrentUrl({ headerResults, finalUrl })).toEqual(finalUrl);
  });
  it('append location to finalUrl', () => {
    const headerResults = [{ headers: [{ name: 'Location', value: '/cookies' }] }];
    const finalUrl = 'http://mergemyshit.dev';
    expect(networkUtils.getCurrentUrl({ headerResults, finalUrl })).toEqual(finalUrl + '/cookies');
  });
  it('appends only last location to finalUrl', () => {
    const headerResults = [{ headers: [{ name: 'Location', value: '/cookies' }] }, { headers: [{ name: 'location', value: '/biscuit' }] }];
    const finalUrl = 'http://mergemyshit.dev';
    expect(networkUtils.getCurrentUrl({ headerResults, finalUrl })).toEqual(finalUrl + '/biscuit');
  });
});

describe('getOrInheritHeaders', () => {
  it('should combine headers', () => {
    const requestGroups = [{ headers: [{ name: 'foo', value: 'bar' }] }, { headers: [{ name: 'baz', value: 'qux' }] }];
    const request = { headers: [{ name: 'foo', value: 'bar' }, { name: 'baz', value: 'qux' }] };
    expect(networkUtils.getOrInheritHeaders({ request, requestGroups })).toEqual([{ name: 'baz', value: 'qux, qux' }, { name: 'foo', value: 'bar, bar' }]);
  });
  it('should use last header casing', () => {
    const requestGroups = [{ headers: [{ name: 'x-foo', value: 'bar' }] }];
    const request = { headers: [{ name: 'X-Foo', value: 'baz' }] };
    expect(networkUtils.getOrInheritHeaders({ request, requestGroups })).toEqual([{ name: 'X-Foo', value: 'bar, baz' }]);
  });
  it('should not combine special headers', () => {
    const requestGroups = [{ headers: [{ name: 'content-type', value: 'application/json' }, { name: 'Connection', value: 'close' }] }];
    const request = { headers: [{ name: 'Content-Type', value: 'text/plain' }, { name: 'connection', value: 'keep-alive' }] };
    expect(networkUtils.getOrInheritHeaders({ request, requestGroups })).toEqual([{ name: 'connection', value: 'keep-alive' }, { name: 'Content-Type', value: 'text/plain' }]);
  });
});
