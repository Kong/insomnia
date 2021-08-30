import path from 'path';

import { globalBeforeEach } from '../../__jest__/before-each';
import * as models from '../../models';
import { AUTH_BASIC } from '../constants';
import * as harUtils from '../har';
import * as render from '../render';

describe('export', () => {
  beforeEach(async () => {
    await globalBeforeEach();
    await models.project.all();
  });

  describe('exportHar()', () => {
    it('exports single requests', async () => {
      const wrk = await models.workspace.create({
        _id: 'wrk_1',
        name: 'Workspace',
      });
      const req1 = await models.request.create({
        _id: 'req_1',
        name: 'Request 1',
        parentId: wrk._id,
        url: 'https://httpstat.us/200',
        method: 'POST',
        body: {
          mimeType: 'application/json',
          text: '{}',
        },
        headers: [
          {
            name: 'Content-Type',
            value: 'application/json',
          },
          {
            name: 'Accept',
            value: 'application/json',
            disabled: false,
          },
          {
            name: 'X-Disabled',
            value: 'X-Disabled',
            disabled: true,
          },
        ],
      });
      await models.response.create({
        parentId: req1._id,
        statusCode: 200,
        statusMessage: 'OK',
        elapsedTime: 999,
        headers: [
          {
            name: 'Content-Type',
            value: 'application/json',
          },
        ],
        contentType: 'application/json',
        bodyPath: path.join(__dirname, '../__fixtures__/har/test-response.json'),
        bodyCompression: null,
      });
      const exportRequests = [
        {
          requestId: req1._id,
          environmentId: 'n/a',
        },
      ];
      const harExport = await harUtils.exportHar(exportRequests);
      expect(harExport).toMatchObject({
        log: {
          version: '1.2',
          creator: {
            name: 'Insomnia REST Client',
          },
          entries: [
            {
              startedDateTime: expect.any(String),
              time: 999,
              request: {
                method: 'POST',
                url: 'https://httpstat.us/200',
                httpVersion: 'HTTP/1.1',
                cookies: [],
                headers: [
                  {
                    name: 'Content-Type',
                    value: 'application/json',
                  },
                  {
                    name: 'Accept',
                    value: 'application/json',
                  },
                ],
                queryString: [],
                postData: {
                  mimeType: 'application/json',
                  params: [],
                  text: '{}',
                },
                headersSize: -1,
                bodySize: -1,
              },
              response: {
                status: 200,
                statusText: 'OK',
                httpVersion: 'HTTP/1.1',
                cookies: [],
                headers: [
                  {
                    name: 'Content-Type',
                    value: 'application/json',
                  },
                ],
                content: {
                  size: 15,
                  mimeType: 'application/json',
                  text: '{"key":"value"}',
                },
                redirectURL: '',
                headersSize: -1,
                bodySize: -1,
              },
              cache: {},
              timings: {
                blocked: -1,
                dns: -1,
                connect: -1,
                send: 0,
                wait: 999,
                receive: 0,
                ssl: -1,
              },
              comment: req1.name,
            },
          ],
        },
      });
    });

    it('exports multiple requests', async () => {
      const workspace = await models.workspace.create({
        _id: 'wrk_1',
        name: 'Workspace',
      });
      const baseReq = await models.request.create({
        _id: 'req_0',
        type: models.request.type,
        name: 'Request',
        parentId: workspace._id,
        url: 'http://localhost',
        method: 'GET',
        body: {},
        headers: [
          {
            name: 'X-Environment',
            value: '{{ envvalue }}',
          },
        ],
      });
      const req1 = await models.request.duplicate(baseReq);
      req1._id = 'req_1';
      req1.name = 'Request 1';
      req1.headers.push({
        name: 'X-Request',
        value: '1',
      });
      await models.request.create(req1);
      const req2 = await models.request.duplicate(baseReq);
      req2._id = 'req_2';
      req2.name = 'Request 2';
      req2.headers.push({
        name: 'X-Request',
        value: '2',
      });
      await models.request.create(req2);
      const req3 = await models.request.duplicate(baseReq);
      req3._id = 'req_3';
      req3.name = 'Request 3';
      req3.headers.push({
        name: 'X-Request',
        value: '3',
      });
      await models.request.create(req3);
      const envBase = await models.environment.getOrCreateForParentId(workspace._id);
      await models.environment.update(envBase, {
        data: {
          envvalue: '',
        },
      });
      const envPublic = await models.environment.create({
        _id: 'env_1',
        name: 'Public',
        parentId: envBase._id,
        data: {
          envvalue: 'public',
        },
      });
      const envPrivate = await models.environment.create({
        _id: 'env_2',
        name: 'Private',
        isPrivate: true,
        parentId: envBase._id,
        data: {
          envvalue: 'private',
        },
      });
      await models.response.create({
        _id: 'res_1',
        parentId: req1._id,
        statusCode: 204,
      });
      await models.response.create({
        _id: 'res_2',
        parentId: req2._id,
        statusCode: 404,
      });
      await models.response.create({
        _id: 'res_3',
        parentId: req3._id,
        statusCode: 500,
      });
      const exportRequests = [
        {
          requestId: req1._id,
          environmentId: null,
        },
        {
          requestId: req2._id,
          environmentId: envPublic._id,
        },
        {
          requestId: req3._id,
          environmentId: envPrivate._id,
        },
      ];
      const harExport = await harUtils.exportHar(exportRequests);
      expect(harExport).toMatchObject({
        log: {
          version: '1.2',
          creator: {
            name: 'Insomnia REST Client',
          },
          entries: [
            {
              request: {
                headers: [
                  {
                    name: 'X-Environment',
                    value: '',
                  },
                  {
                    name: 'X-Request',
                    value: '1',
                  },
                ],
              },
              response: {
                status: 204,
              },
              comment: req1.name,
            },
            {
              request: {
                headers: [
                  {
                    name: 'X-Environment',
                    value: 'public',
                  },
                  {
                    name: 'X-Request',
                    value: '2',
                  },
                ],
              },
              response: {
                status: 404,
              },
              comment: req2.name,
            },
            {
              request: {
                headers: [
                  {
                    name: 'X-Environment',
                    value: 'private',
                  },
                  {
                    name: 'X-Request',
                    value: '3',
                  },
                ],
              },
              response: {
                status: 500,
              },
              comment: req3.name,
            },
          ],
        },
      });
    });
  });

  describe('exportHarResponse()', () => {
    it('exports a default har response for an empty response', async () => {
      const notFoundResponse = null;
      const harResponse = await harUtils.exportHarResponse(notFoundResponse);
      expect(harResponse).toMatchObject({
        status: 0,
        statusText: '',
        httpVersion: 'HTTP/1.1',
        content: {
          size: 0,
          mimeType: '',
        },
      });
    });

    it('exports a valid har response for a non empty response', async () => {
      const response = Object.assign(models.response.init(), {
        _id: 'res_123',
        type: models.response.type,
        parentId: 'req_123',
        modified: 0,
        created: 0,
        statusCode: 200,
        statusMessage: 'OK',
        headers: [
          {
            name: 'Content-Type',
            value: 'application/json',
          },
          {
            name: 'Content-Length',
            value: '2',
          },
          {
            name: 'Set-Cookie',
            value: 'sessionid=12345; HttpOnly; Path=/',
          },
        ],
        contentType: 'application/json',
        bodyPath: path.join(__dirname, '../__fixtures__/har/test-response.json'),
      });
      const harResponse = await harUtils.exportHarResponse(response);
      expect(harResponse).toMatchObject({
        status: 200,
        statusText: 'OK',
        httpVersion: 'HTTP/1.1',
        cookies: [
          {
            name: 'sessionid',
            value: '12345',
            path: '/',
            httpOnly: true,
          },
        ],
        headers: [
          {
            name: 'Content-Type',
            value: 'application/json',
          },
          {
            name: 'Content-Length',
            value: '2',
          },
          {
            name: 'Set-Cookie',
            value: 'sessionid=12345; HttpOnly; Path=/',
          },
        ],
        content: {
          size: 15,
          mimeType: 'application/json',
          text: '{"key":"value"}',
        },
        redirectURL: '',
        headersSize: -1,
        bodySize: -1,
      });
    });
  });

  describe('exportHarWithRequest()', () => {
    it('renders does it correctly', async () => {
      const workspace = await models.workspace.create();
      const cookies = [
        {
          creation: new Date('2016-10-05T04:40:49.505Z'),
          key: 'foo',
          value: 'barrrrr',
          expires: new Date('2096-10-12T04:40:49.000Z'),
          domain: 'google.com',
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
        ],
        parameters: [
          {
            name: 'foo bar',
            value: 'hello&world',
          },
        ],
        method: 'POST',
        body: {
          text: 'foo bar',
        },
        url: 'http://google.com',
        authentication: {
          type: AUTH_BASIC,
          username: 'user',
          password: 'pass',
        },
      });
      const { request: renderedRequest } = await render.getRenderedRequestAndContext({ request });
      const har = await harUtils.exportHarWithRequest(renderedRequest);
      expect(har.cookies.length).toBe(1);
      expect(har).toEqual({
        bodySize: -1,
        cookies: [
          {
            domain: 'google.com',
            expires: '2096-10-12T04:40:49.000Z',
            name: 'foo',
            path: '/',
            value: 'barrrrr',
          },
        ],
        headers: [
          {
            name: 'Content-Type',
            value: 'application/json',
          },
          {
            name: 'Authorization',
            value: 'Basic dXNlcjpwYXNz',
          },
        ],
        headersSize: -1,
        httpVersion: 'HTTP/1.1',
        method: 'POST',
        postData: {
          mimeType: '',
          params: [],
          text: 'foo bar',
        },
        queryString: [
          {
            name: 'foo bar',
            value: 'hello&world',
          },
        ],
        url: 'http://google.com/',
        settingEncodeUrl: true,
      });
    });

    it('export multipart request with file', async () => {
      const workspace = await models.workspace.create();
      const request = Object.assign(models.request.init(), {
        _id: 'req_123',
        parentId: workspace._id,
        headers: [
          {
            name: 'Content-Type',
            value: 'multipart/form-data',
          },
        ],
        parameters: [],
        method: 'POST',
        body: {
          mimeType: 'multipart/form-data',
          params: [
            {
              name: 'a_file',
              value: '',
              fileName: '/tmp/my_file',
              type: 'file',
            },
            {
              name: 'a_simple_field',
              value: 'a_simple_value',
            },
            {
              name: 'a_second_file',
              value: '',
              fileName: '/tmp/my_file_2',
              type: 'file',
            },
          ],
        },
        url: 'http://example.com/post',
        authentication: {},
      });
      const { request: renderedRequest } = await render.getRenderedRequestAndContext({ request });
      const har = await harUtils.exportHarWithRequest(renderedRequest);
      expect(har).toEqual({
        bodySize: -1,
        cookies: [],
        headers: [
          {
            name: 'Content-Type',
            value: 'multipart/form-data',
          },
        ],
        headersSize: -1,
        httpVersion: 'HTTP/1.1',
        method: 'POST',
        postData: {
          mimeType: 'multipart/form-data',
          params: [
            {
              name: 'a_file',
              fileName: '/tmp/my_file',
            },
            {
              name: 'a_simple_field',
              value: 'a_simple_value',
            },
            {
              name: 'a_second_file',
              fileName: '/tmp/my_file_2',
            },
          ],
          text: '',
        },
        queryString: [],
        url: 'http://example.com/post',
        settingEncodeUrl: true,
      });
    });
  });
});
