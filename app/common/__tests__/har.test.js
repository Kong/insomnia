import * as harUtils from '../har';
import * as render from '../render';
import * as models from '../../models';
import {AUTH_BASIC} from '../constants';
import {globalBeforeEach} from '../../__jest__/before-each';

describe('exportHarWithRequest()', () => {
  beforeEach(globalBeforeEach);
  it('renders does it correctly', async () => {
    const workspace = await models.workspace.create();
    const cookies = [{
      creation: new Date('2016-10-05T04:40:49.505Z'),
      key: 'foo',
      value: 'barrrrr',
      expires: new Date('2096-10-12T04:40:49.000Z'),
      domain: 'google.com',
      path: '/',
      hostOnly: true,
      lastAccessed: new Date('2096-10-05T04:40:49.505Z')
    }];

    const cookieJar = await models.cookieJar.getOrCreateForParentId(workspace._id);
    await models.cookieJar.update(cookieJar, {
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
        text: 'foo bar'
      },
      url: 'http://google.com',
      authentication: {
        type: AUTH_BASIC,
        username: 'user',
        password: 'pass'
      }
    });

    const renderedRequest = await render.getRenderedRequest(request);
    const har = await harUtils.exportHarWithRequest(renderedRequest);

    expect(har.cookies.length).toBe(1);
    expect(har).toEqual({
      bodySize: -1,
      cookies: [{
        creation: '2016-10-05T04:40:49.505Z',
        domain: 'google.com',
        expires: '2096-10-12T04:40:49.000Z',
        hostOnly: true,
        key: 'foo',
        name: 'foo',
        path: '/',
        value: 'barrrrr',
        // lastAccessed is updated, so lets hack the assertion
        lastAccessed: har.cookies[0].lastAccessed
      }],
      headers: [
        {name: 'Content-Type', value: 'application/json'},
        {name: 'Authorization', value: 'Basic dXNlcjpwYXNz'}
      ],
      headersSize: -1,
      httpVersion: 'HTTP/1.1',
      method: 'POST',
      postData: {
        text: 'foo bar'
      },
      queryString: [{name: 'foo bar', value: 'hello&world'}],
      url: 'http://google.com/'
    });
  });
});
