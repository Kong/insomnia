import {
  distinctByProperty,
  fillServerVariables,
  generateSlug,
  getMethodAnnotationName,
  getName,
  getPaths,
  getPluginNameFromKey,
  getSecurity,
  getServers,
  hasUpstreams,
  HttpMethodType,
  isHttpMethodKey,
  isPluginKey,
  parseUrl,
  pathVariablesToRegex,
} from './common';
import { getSpec } from './declarative-config/jest/test-helpers';
import { xKongName } from './types/kong';
import { OA3Operation, OA3Server } from './types/openapi3';

describe('common', () => {
  describe('getPaths()', () => {
    it('should return api paths', () => {
      const paths = {
        '/': {
          description: 'test',
        },
      };
      const api = getSpec({ paths });
      const result = getPaths(api);
      expect(result).toStrictEqual(paths);
    });
  });

  describe('getServers()', () => {
    const spec = getSpec({
      servers: [
        {
          url: 'https://server1.com/path',
        },
      ],
      paths: {
        '/': {
          servers: [
            {
              url: 'https://server2.com/path',
            },
          ],
        },
      },
    });

    it('returns path item servers', () => {
      const result = getServers(spec.paths['/']);
      expect(result).toEqual([
        {
          url: 'https://server2.com/path',
        },
      ]);
    });

    it('returns api servers', () => {
      const result = getServers(spec);
      expect(result).toEqual([
        {
          url: 'https://server1.com/path',
        },
      ]);
    });
  });

  describe('getSecurity()', () => {
    it('returns security from operation', () => {
      const operation: OA3Operation = {
        security: [
          {
            petstoreAuth: [],
          },
        ],
        responses: {},
      };
      const result = getSecurity(operation);
      expect(result).toEqual([
        {
          petstoreAuth: [],
        },
      ]);
    });

    it('returns security from api', () => {
      const spec = getSpec({
        servers: [
          {
            url: 'https://server1.com/path',
          },
        ],
        paths: {
          '/': {
            post: {
              security: [
                {
                  petstoreAuth: [],
                },
              ],
              responses: {},
            },
          },
        },
        security: [
          {
            anotherAuth: [],
          },
        ],
        components: {
          securitySchemes: {
            petstoreAuth: {
              type: 'http',
              scheme: 'basic',
              name: 'name',
            },
            anotherAuth: {
              type: 'http',
              scheme: 'basic',
              name: 'another-name',
            },
          },
        },
      });
      const result = getSecurity(spec);
      expect(result).toEqual([
        {
          anotherAuth: [],
        },
      ]);
    });
  });

  describe('getName()', () => {
    it('openapi object with x-kong-name', () => {
      const spec = getSpec({ [xKongName]: 'override' });
      const result = getName(spec);
      expect(result).toBe('override');
    });

    it('openapi object without x-kong-name', () => {
      const spec = getSpec();
      const result = getName(spec);
      expect(result).toBe('My_API');
    });

    it('openapi object without anything', () => {
      const spec = getSpec({
        info: {
          version: '1.0.0',
        },
      });
      const result = getName(spec);
      expect(result).toBe('openapi');
      const result2 = getName(spec, 'Another Default');
      expect(result2).toBe('Another_Default');
    });

    it('works with slugify options', () => {
      const spec = getSpec({ [xKongName]: 'This Needs Slugify' });
      const result = getName(spec, '', {
        replacement: '?',
        lower: true,
      });
      expect(result).toBe('this?needs?slugify');
    });
  });

  describe('generateSlug()', () => {
    it('passes basic cases', () => {
      expect(generateSlug('foo')).toBe('foo');
      expect(generateSlug('foo bar')).toBe('foo_bar');
      expect(generateSlug('foo, bar')).toBe('foo_bar');
      expect(generateSlug('Foo Bar')).toBe('Foo_Bar');
      expect(
        generateSlug('foo bar', {
          replacement: '?',
        }),
      ).toBe('foo?bar');
      expect(
        generateSlug('FOO Bar', {
          lower: true,
        }),
      ).toBe('foo_bar');
    });
  });

  describe('fillServerVariables()', () => {
    it('parses basic url', () => {
      const server = {
        url: 'https://swagger.io/v1',
      };
      expect(fillServerVariables(server)).toBe('https://swagger.io/v1');
    });

    it('replaces variables', () => {
      const server = {
        url: 'https://{subdomain}.swagger.io/v1',
        variables: {
          subdomain: {
            default: 'petstore',
          },
        },
      };
      expect(fillServerVariables(server)).toBe('https://petstore.swagger.io/v1');
    });

    it('fails with no default value', () => {
      const server: OA3Server = {
        url: 'https://{subdomain}.swagger.io/v1',
        variables: {
          // @ts-expect-error intentionally invalid - missing a required property, `default`
          subdomain: {
            enum: ['petstore'],
          },
        },
      };

      const fn = () => fillServerVariables(server);

      expect(fn).toThrowError('Server variable "subdomain" missing default value');
    });
  });

  describe('pathVariablesToRegex()', () => {
    it('converts variables to regex path', () => {
      expect(pathVariablesToRegex('/foo/{bar}/{baz}')).toBe(
        '/foo/(?<bar>[^\\/]+)/(?<baz>[^\\/]+)$',
      );
    });

    it('does not convert to regex if no variables present', () => {
      expect(pathVariablesToRegex('/foo/bar/baz')).toBe('/foo/bar/baz$');
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
      expect(isPluginKey(xKongName)).toBe(false);
    });
  });

  const methods: HttpMethodType[] = [
    'GET',
    'PUT',
    'POST',
    'DELETE',
    'OPTIONS',
    'HEAD',
    'PATCH',
    'TRACE',
  ];

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

    it('returns localhost if not given', () => {
      const result = parseUrl('/just/a/path');
      expect(result.host).toBe('localhost:80');
    });

    it('returns no port in host if neither port nor recognized protocol given', () => {
      const result = parseUrl('tcp://api.insomnia.rest/just/a/path');
      expect(result.host).toBe('api.insomnia.rest');
    });

    it('returns default port in host if protocol given', () => {
      const result = parseUrl('https://api.insomnia.rest/just/a/path');
      expect(result.host).toBe('api.insomnia.rest:443');
    });

    it('returns pathname if defined in url', () => {
      const result = parseUrl('http://api.insomnia.rest/api/v1');
      expect(result.pathname).toBe('/api/v1');
    });
  });

  describe('hasUpstreams()', () => {
    it('given no server.url item should have no upstreams', () => {
      expect(hasUpstreams({ servers:[] } as any)).toBe(false);
    });
    it('given one server.url item should have no upstreams', () => {
      expect(hasUpstreams({ servers:[{ url:'/test1' }] } as any)).toBe(false);
    });
    it('given one server.url item and x-kong-upstream-defaults should have upstreams', () => {
      expect(hasUpstreams({ servers:[{ url:'/test1' }], 'x-kong-upstream-defaults':{} } as any)).toBe(true);
    });
    it('given multiple server.url items should have upstreams', () => {
      expect(hasUpstreams({ servers:[{ url:'/test1' }, { url:'/test2' }] } as any)).toBe(true);
    });
  });

  describe('distinctByProperty()', () => {
    it('returns empty array if no truthy items', () => {
      expect(distinctByProperty([], i => i)).toHaveLength(0);
      expect(distinctByProperty([undefined], i => i)).toHaveLength(0);
      expect(distinctByProperty([null, undefined, ''], i => i)).toHaveLength(0);
    });

    it('should remove objects with the same property selector - removes 2/4', () => {
      const item1 = {
        name: 'a',
        value: 'first',
      };
      const item2 = {
        name: 'a',
        value: 'second',
      };
      const item3 = {
        name: 'b',
        value: 'third',
      };
      const item4 = {
        name: 'b',
        value: 'fourth',
      };
      const items = [item1, item2, item3, item4];
      // distinct by the name property
      const filtered = distinctByProperty(items, i => i.name);
      // Should remove item2 and item4
      expect(filtered).toEqual([item1, item3]);
    });

    it('should remove objects with the same property selector - removes none', () => {
      const item1 = {
        name: 'a',
        value: 'first',
      };
      const item2 = {
        name: 'a',
        value: 'second',
      };
      const item3 = {
        name: 'b',
        value: 'third',
      };
      const item4 = {
        name: 'b',
        value: 'fourth',
      };
      const items = [item1, item2, item3, item4];
      // distinct by the value property
      const filtered = distinctByProperty(items, i => i.value);
      // Should remove no items
      expect(filtered).toEqual(items);
    });
  });
});
