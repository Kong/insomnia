// @flow
import {
  fillServerVariables,
  generateSlug,
  getMethodAnnotationName,
  getName,
  getPaths,
  getPluginNameFromKey,
  getSecurity,
  getServers,
  isHttpMethodKey,
  isPluginKey,
  parseUrl,
  pathVariablesToRegex,
} from '../common';
import { parseSpec } from '../index';

describe('common', () => {
  const spec: OpenApi3Spec = {
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'Swagger Petstore',
    },
    servers: [{ url: 'https://server1.com/path' }],
    paths: {},
  };

  describe('getPaths()', () => {
    it('should return api paths', () => {
      const paths = {
        '/': {
          description: 'test',
        },
      };

      const api = {
        ...spec,
        paths,
      };

      const result = getPaths(api);

      expect(result).toBe(paths);
    });
  });

  describe('getServers()', () => {
    const spec = {
      openapi: '3.0.0',
      info: {
        version: '1.0.0',
        title: 'Swagger Petstore',
      },
      servers: [{ url: 'https://server1.com/path' }],
      paths: {
        '/': {
          servers: [{ url: 'https://server2.com/path' }],
        },
      },
    };

    it('returns path item servers', async () => {
      const s = await parseSpec(spec);
      const result = getServers(s.paths['/']);
      expect(result).toEqual([{ url: 'https://server2.com/path' }]);
    });

    it('returns api servers', async () => {
      const s = await parseSpec(spec);
      const result = getServers(s);
      expect(result).toEqual([{ url: 'https://server1.com/path' }]);
    });
  });

  describe('getSecurity()', () => {
    it('returns security from operation', () => {
      const operation: OA3Operation = {
        security: [{ petstoreAuth: [] }],
        responses: {},
      };

      const result = getSecurity(operation);
      expect(result).toEqual([{ petstoreAuth: [] }]);
    });

    it('returns security from api', () => {
      const spec: OpenApi3Spec = {
        openapi: '3.0.0',
        info: {
          version: '1.0.0',
          title: 'Swagger Petstore',
        },
        servers: [{ url: 'https://server1.com/path' }],
        paths: {
          '/': {
            post: {
              security: [{ petstoreAuth: [] }],
              responses: {},
            },
          },
        },
        security: [{ anotherAuth: [] }],
        components: {
          securitySchemes: {
            petstoreAuth: { type: 'http', scheme: 'basic', name: 'name' },
            anotherAuth: { type: 'http', scheme: 'basic', name: 'another-name' },
          },
        },
      };
      const result = getSecurity(spec);
      expect(result).toEqual([{ anotherAuth: [] }]);
    });
  });

  describe('getName()', () => {
    const spec = {
      openapi: '3.0.0',
      info: { version: '1.0.0', title: 'Swagger Petstore' },
      servers: [{ url: 'https://server1.com/path' }],
      paths: {},
    };

    it('openapi object with x-kong-name', async () => {
      const s = await parseSpec({ ...spec, 'x-kong-name': 'override' });
      const result = getName(s);
      expect(result).toBe('override');
    });

    it('openapi object without x-kong-name', async () => {
      const s = await parseSpec(spec);
      const result = getName(s);
      expect(result).toBe('Swagger_Petstore');
    });

    it('openapi object without anything', async () => {
      const s = await parseSpec({ ...spec, info: { version: '1.0.0' } });
      const result = getName(s);
      expect(result).toBe('openapi');

      const result2 = getName(s, 'Another Default');
      expect(result2).toBe('Another_Default');
    });

    it('works with slugify options', () => {
      const p = { ...spec, 'x-kong-name': 'This Needs Slugify' };
      const result = getName(p, '', { replacement: '?', lower: true });
      expect(result).toBe('this?needs?slugify');
    });
  });

  describe('generateSlug()', () => {
    it('passes basic cases', () => {
      expect(generateSlug('foo')).toBe('foo');
      expect(generateSlug('foo bar')).toBe('foo_bar');
      expect(generateSlug('foo, bar')).toBe('foo_bar');
      expect(generateSlug('Foo Bar')).toBe('Foo_Bar');
      expect(generateSlug('foo bar', { replacement: '?' })).toBe('foo?bar');
      expect(generateSlug('FOO Bar', { lower: true })).toBe('foo_bar');
    });
  });

  describe('fillServerVariables()', () => {
    it('parses basic url', () => {
      const server = { url: 'https://swagger.io/v1' };
      expect(fillServerVariables(server)).toBe('https://swagger.io/v1');
    });

    it('replaces variables', () => {
      const server = {
        url: 'https://{subdomain}.swagger.io/v1',
        variables: { subdomain: { default: 'petstore' } },
      };
      expect(fillServerVariables(server)).toBe('https://petstore.swagger.io/v1');
    });

    it('fails with no default value', () => {
      const server: Object = {
        url: 'https://{subdomain}.swagger.io/v1',
        variables: { subdomain: { enum: ['petstore'] } },
      };

      const fn = () => fillServerVariables(server);
      expect(fn).toThrowError('Server variable "subdomain" missing default value');
    });
  });

  describe('pathVariablesToRegex()', () => {
    it('converts variables to regex path', () => {
      expect(pathVariablesToRegex('/foo/{bar}/{baz}')).toBe('/foo/(?<bar>\\S+)/(?<baz>\\S+)$');
    });

    it('does not convert to regex if no variables present', () => {
      expect(pathVariablesToRegex('/foo/bar/baz')).toBe('/foo/bar/baz');
    });
  });

  describe('getPluginNameFromKey()', () => {
    it('should remove x-kong-plugin- prefix to extract name', () => {
      expect(getPluginNameFromKey('x-kong-plugin-name')).toBe('name');
    });
  });

  describe('isPluginKey()', () => {
    it('should be true if key is prefixed by x-kong-plugin-', () => {
      expect(isPluginKey('x-kong-plugin-name')).toBe(true);
    });
    it('should be false if key is not prefixed by x-kong-plugin-', () => {
      expect(isPluginKey('x-kong-name')).toBe(false);
    });
  });

  const methods = ['get', 'put', 'post', 'options', 'delete', 'head', 'patch', 'trace'];
  describe('isHttpMethodKey()', () => {
    it.each(methods)('should be true for %o', method => {
      expect(isHttpMethodKey(method)).toBe(true);
    });
    it('should be false for non http method key', () => {
      expect(isHttpMethodKey('test')).toBe(false);
    });
  });

  describe('getMethodAnnotationName', () => {
    it.each(methods)('should suffix with -method and lowercase: %o', method => {
      expect(getMethodAnnotationName(method)).toBe(`${method}-method`.toLowerCase());
    });
  });

  describe('parseUrl()', () => {
    it('returns / for pathname if no path', () => {
      const result = parseUrl('http://api.insomnia.rest');
      expect(result.pathname).toBe('/');
    });

    it('returns pathname if defined in url', () => {
      const result = parseUrl('http://api.insomnia.rest/api/v1');
      expect(result.pathname).toBe('/api/v1');
    });
  });
});
