import * as networkUtils from '../network';
import * as db from '../../database';
import nock from 'nock';
import {getRenderedRequest} from '../render';

describe('buildRequestConfig()', () => {
  beforeEach(() => db.initDB({inMemoryOnly: true}, true));

  it('builds a default config', () => {
    return db.workspaceCreate().then(workspace => {
      const request = Object.assign(db.MODEL_DEFAULTS[db.TYPE_REQUEST](), {
        parentId: workspace._id
      });

      return getRenderedRequest(request).then(renderedRequest => {
        const config = networkUtils._buildRequestConfig(renderedRequest);
        expect(config).toEqual({
          body: '',
          followAllRedirects: true,
          gzip: true,
          headers: {},
          maxRedirects: 20,
          method: 'GET',
          proxy: null,
          rejectUnauthorized: true,
          time: true,
          timeout: 0,
          url: 'http://'
        });
      });
    })
  });

  it('builds a complex config', () => {
    return db.workspaceCreate().then(workspace => {
      const request = Object.assign(db.MODEL_DEFAULTS[db.TYPE_REQUEST](), {
        parentId: workspace._id,
        headers: [{name: 'Content-Type', value: 'application/json'}],
        parameters: [{name: 'foo bar', value: 'hello&world'}],
        method: 'POST',
        body: 'foo=bar',
        url: 'http://foo.com/★/foo%20bar?bar=baz',
        authentication: {
          username: 'user',
          password: 'pass'
        }
      });

      return getRenderedRequest(request).then(renderedRequest => {
        const config = networkUtils._buildRequestConfig(renderedRequest);
        expect(config).toEqual({
          body: 'foo=bar',
          followAllRedirects: true,
          gzip: true,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic dXNlcjpwYXNz'
          },
          maxRedirects: 20,
          method: 'POST',
          proxy: null,
          rejectUnauthorized: true,
          time: true,
          timeout: 0,
          url: 'http://foo.com/%E2%98%85/foo%2520bar?bar=baz&foo%20bar=hello%26world'
        });
      });
    })
  });
});

describe('actuallySend()', () => {
  beforeEach(() => db.initDB({inMemoryOnly: true}, true));

  it('does something', () => {
    let settings, mock;

    return Promise.all([
      db.workspaceCreate(),
      db.settingsCreate()
    ]).then(([workspace, newSettings]) => {
      settings = newSettings;

      mock = nock('http://foo.com')
        .matchHeader('Content-Type', 'application/json')
        .matchHeader('Authorization', 'Basic dXNlcjpwYXNz')
        .post('/')
        .query({'foo bar': 'hello&world'})
        .reply(200, 'response body')
        .log(console.log);

      const request = Object.assign(db.MODEL_DEFAULTS[db.TYPE_REQUEST](), {
        _id: 'req_123',
        parentId: workspace._id,
        headers: [{name: 'Content-Type', value: 'application/json'}],
        parameters: [{name: 'foo bar', value: 'hello&world'}],
        method: 'POST',
        body: 'foo=bar',
        url: 'http://foo.com',
        authentication: {
          username: 'user',
          password: 'pass'
        }
      });

      return getRenderedRequest(request);
    }).then(renderedRequest => {
      return networkUtils._actuallySend(renderedRequest, settings);
    }).then(response => {
      expect(mock.basePath).toBe('http://foo.com:80');
      expect(response.url).toBe('http://foo.com/?foo%20bar=hello%26world');
      expect(response.body).toBe('response body');
      expect(response.statusCode).toBe(200);
    });
  });
});
