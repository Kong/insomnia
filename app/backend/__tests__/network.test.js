'use strict';

const networkUtils = require('../network');
const db = require('../database');
const nock = require('nock');
const {getRenderedRequest} = require('../render');

describe('buildRequestConfig()', () => {
  beforeEach(() => db.initDB({inMemoryOnly: true}, true));

  it('builds a default config', () => {
    return db.workspace.create().then(workspace => {
      const request = Object.assign(db.request.init(), {
        parentId: workspace._id
      });

      return getRenderedRequest(request).then(renderedRequest => {
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
    })
  });

  it('builds a complex config', () => {
    return db.workspace.create().then(workspace => {
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

      return getRenderedRequest(request).then(renderedRequest => {
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
          url: 'http://foo.com:3332/%E2%98%85/foo%2520bar?bar=baz&foo%20bar=hello%26world'
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
      db.workspace.create(),
      db.settings.create()
    ]).then(([workspace, newSettings]) => {
      settings = newSettings;

      mock = nock('http://foo.com')
        .matchHeader('Content-Type', 'application/json')
        .matchHeader('Authorization', 'Basic dXNlcjpwYXNz')
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
