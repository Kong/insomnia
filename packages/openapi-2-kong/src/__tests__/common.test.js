import {
  fillServerVariables,
  generateSlug,
  getName,
  getSecurity,
  getServers,
  pathVariablesToRegex,
} from '../common';
import { parseSpec } from '../index';

describe('common', () => {
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
    const spec = {
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
          petstoreAuth: { type: 'http', scheme: 'basic' },
          anotherAuth: { type: 'http', scheme: 'basic' },
        },
      },
    };

    it('returns path item security', async () => {
      const s = await parseSpec(spec);
      const result = getSecurity(s.paths['/'].post);
      expect(result).toEqual([{ petstoreAuth: [] }]);
    });

    it('returns api security', async () => {
      const s = await parseSpec(spec);
      const result = getSecurity(s);
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

    it('openapi object without', async () => {
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

    it('path object with x-kong-name', async () => {
      const p = { 'x-kong-name': 'kong' };
      const result = getName(p);
      expect(result).toBe('kong');
    });

    it('path object with summary', async () => {
      const p = { 'x-kong-name': 'kong' };
      const result = getName(p);
      expect(result).toBe('kong');
    });

    it('works with slugify options', async () => {
      const p = { 'x-kong-name': 'This Needs Slugify' };
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
      const server = {
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
});
