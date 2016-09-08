import * as networkUtils from '../network';
import * as db from '../../database';
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
        url: 'http://foo.com?bar=baz',
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
          url: 'http://foo.com/?bar=baz&foo%20bar=hello%26world'
        });
      });
    })
  });
});
