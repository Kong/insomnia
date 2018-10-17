const { jarFromCookies, cookiesFromJar } = require('insomnia-cookies');
const tag = require('..').templateTags[0];

describe('plugin', () => {
  describe('CookieJarPlugin: no cookies for url', async () => {
    it('should get cookie by name', async () => {
      const jar = jarFromCookies([]);
      jar.setCookieSync(
        [
          'foo=bar',
          'path=/',
          'domain=.insomnia.rest',
          'HttpOnly Cache-Control: public, no-cache'
        ].join('; '),
        'https://insomnia.rest'
      );

      const cookies = await cookiesFromJar(jar);
      const requests = [{ _id: 'req_1', parameters: [], url: 'https://insomnia.rest/foo/bar' }];
      const jars = [{ _id: 'jar_1', parentId: 'wrk_1', cookies }];
      const context = _getTestContext([{ _id: 'wrk_1' }], requests, jars);
      try {
        const result = await tag.run(context, 'https://google.com/', '');
      } catch (err) {
        expect(err.message).toContain('No cookies in store for url "https://google.com/');
      }
    });
  });

  describe('CookieJarPlugin: cookie not found', async () => {
    it('should get cookie by name', async () => {
      const jar = jarFromCookies([]);
      jar.setCookieSync(
        [
          'foo=bar',
          'path=/',
          'domain=.insomnia.rest',
          'HttpOnly Cache-Control: public, no-cache'
        ].join('; '),
        'https://insomnia.rest'
      );

      const cookies = await cookiesFromJar(jar);
      const requests = [{ _id: 'req_1', parameters: [], url: 'https://insomnia.rest/foo/bar' }];
      const jars = [{ _id: 'jar_1', parentId: 'wrk_1', cookies }];
      const context = _getTestContext([{ _id: 'wrk_1' }], requests, jars);
      try {
        const result = await tag.run(context, 'https://insomnia.rest', 'bar');
      } catch (err) {
        expect(err.message).toContain('No cookie with name "bar"');
        expect(err.message).toContain('"foo"');
      }
    });
  });

  describe('CookieJarPlugin: cookie name found', async () => {
    it('should get cookie by name', async () => {
      const jar = jarFromCookies([]);
      jar.setCookieSync(
        [
          'foo=bar',
          'path=/',
          'domain=.insomnia.rest',
          'HttpOnly Cache-Control: public, no-cache'
        ].join('; '),
        'https://insomnia.rest'
      );

      const cookies = await cookiesFromJar(jar);
      const requests = [{ _id: 'req_1', parameters: [], url: 'https://insomnia.rest/foo/bar' }];
      const jars = [{ _id: 'jar_1', parentId: 'wrk_1', cookies }];
      const context = _getTestContext([{ _id: 'wrk_1' }], requests, jars);
      const result = await tag.run(context, 'https://insomnia.rest', 'foo');

      expect(result).toBe('bar');
    });
  });
});

function _getTestContext(workspaces, requests, jars) {
  jars = jars || [];
  return {
    meta: {
      requestId: requests[0]._id,
      workspaceId: workspaces[0]._id
    },
    util: {
      render(str) {
        return str.replace(/{{ foo }}/g, 'bar');
      },
      models: {
        request: {
          getById(id) {
            return requests.find(r => r._id === id);
          }
        },
        workspace: {
          getById(id) {
            return workspaces.find(w => w._id === id);
          }
        },
        cookieJar: {
          getOrCreateForWorkspace(workspace) {
            return (
              jars.find(j => j.parentId === workspace._id) || {
                parentId: workspace._id,
                cookies: []
              }
            );
          }
        }
      }
    }
  };
}
