const { jarFromCookies, cookiesFromJar } = require('insomnia-cookies');
const tag = require('..').templateTags[0];

describe('plugin', () => {
  describe('RequestExtension cookie', () => {
    it('should get cookie by name', async () => {
      const jar = jarFromCookies([]);
      jar.setCookieSync(
        [
          'foo=bar',
          'path=/',
          'domain=.insomnia.rest',
          'HttpOnly Cache-Control: public, no-cache',
        ].join('; '),
        'https://insomnia.rest',
      );

      const cookies = await cookiesFromJar(jar);
      const requests = [{ _id: 'req_1', parameters: [], url: 'https://insomnia.rest/foo/bar' }];
      const jars = [{ _id: 'jar_1', parentId: 'wrk_1', cookies }];
      const context = _getTestContext([{ _id: 'wrk_1' }], requests, jars);
      const result = await tag.run(context, 'cookie', 'foo');

      expect(result).toBe('bar');
    });
  });

  describe('RequestExtension url', () => {
    it('should get url', async () => {
      const requests = [
        {
          _id: 'req_1',
          parameters: [{ name: 'foo', value: 'bar' }],
          url: 'https://insomnia.rest/foo/bar',
        },
      ];
      const context = _getTestContext([{ _id: 'wrk_1' }], requests);
      const result = await tag.run(context, 'url');

      expect(result).toBe('https://insomnia.rest/foo/bar?foo=bar');
    });

    it('should get rendered url', async () => {
      const requests = [
        {
          _id: 'req_1',
          parameters: [{ name: 'foo', value: '{{ foo }}' }],
          url: 'https://insomnia.rest/foo/bar',
        },
      ];
      const context = _getTestContext([{ _id: 'wrk_1' }], requests);
      const result = await tag.run(context, 'url');

      expect(result).toBe('https://insomnia.rest/foo/bar?foo=bar');
    });
  });

  describe('RequestExtension header', () => {
    it('should get url', async () => {
      const requests = [
        {
          _id: 'req_1',
          headers: [{ name: 'foo', value: '{{ foo }}' }],
          url: 'https://insomnia.rest/foo/bar',
        },
      ];
      const context = _getTestContext([{ _id: 'wrk_1' }], requests);
      const result = await tag.run(context, 'header', 'foo');

      expect(result).toBe('bar');
    });
  });

  describe('RequestExtension parameter', () => {
    it('should get parameter', async () => {
      const requests = [
        {
          _id: 'req_1',
          parameters: [{ name: 'foo', value: '{{ foo }}' }],
          url: 'https://insomnia.rest/foo/bar',
        },
      ];
      const context = _getTestContext([{ _id: 'wrk_1' }], requests);
      const result = await tag.run(context, 'parameter', 'foo');

      expect(result).toBe('bar');
    });
  });

  describe('RequestExtension name', () => {
    it('should get name', async () => {
      const requests = [
        {
          _id: 'req_1',
          name: 'Foo',
          parameters: [{ name: 'foo', value: '{{ foo }}' }],
          url: 'https://insomnia.rest/foo/bar',
        },
      ];
      const context = _getTestContext([{ _id: 'wrk_1' }], requests);
      const result = await tag.run(context, 'name');

      expect(result).toBe('Foo');
    });
  });
});

function _getTestContext(workspaces, requests, jars) {
  jars = jars || [];
  return {
    meta: {
      requestId: requests[0]._id,
      workspaceId: workspaces[0]._id,
    },
    util: {
      render(str) {
        return str.replace(/{{ foo }}/g, 'bar');
      },
      models: {
        request: {
          getById(id) {
            return requests.find(r => r._id === id);
          },
        },
        workspace: {
          getById(id) {
            return workspaces.find(w => w._id === id);
          },
        },
        cookieJar: {
          getOrCreateForWorkspace(workspace) {
            return (
              jars.find(j => j.parentId === workspace._id) || {
                parentId: workspace._id,
                cookies: [],
              }
            );
          },
        },
      },
    },
  };
}
