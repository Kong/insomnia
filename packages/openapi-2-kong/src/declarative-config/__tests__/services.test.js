// @flow
import { generateServices } from '../services';
import { parseSpec } from '../../index';
import { getSpec } from './utils';

const xKongPluginRequestValidator = 'x-kong-plugin-request-validator';
const xKongRouteDefaults = 'x-kong-route-defaults';

/** This function is written in such a way as to allow mutations in tests but without affecting other tests. */
const getSpecResult = () =>
  JSON.parse(
    JSON.stringify({
      host: 'My_API',
      name: 'My_API',
      plugins: [],
      path: '/path',
      port: 443,
      protocol: 'https',
      tags: ['Tag'],
      routes: [
        {
          name: 'My_API-Cat_stuff-post',
          strip_path: false,
          methods: ['POST'],
          paths: ['/cats$'],
          tags: ['Tag'],
        },
        {
          name: 'My_API-dogs-get',
          strip_path: false,
          methods: ['GET'],
          paths: ['/dogs$'],
          tags: ['Tag'],
        },
        {
          name: 'My_API-dogs-post',
          strip_path: false,
          methods: ['POST'],
          paths: ['/dogs$'],
          tags: ['Tag'],
        },
        {
          name: 'My_API-birds_id-get',
          strip_path: false,
          methods: ['GET'],
          paths: ['/birds/(?<id>[^\\/\\s]+)$'],
          tags: ['Tag'],
        },
      ],
    }),
  );

describe('services', () => {
  describe('error states and validation', () => {
    it('fails with no servers', async () => {
      const spec = getSpec();
      delete spec.servers;

      const api = await parseSpec(spec);
      const fn = () => generateServices(api, ['Tag']);
      expect(fn).toThrowError('no servers defined in spec');
    });

    it('throws for a root level x-kong-route-default', async () => {
      const spec = getSpec();
      spec[xKongRouteDefaults] = 'foo';

      const api = await parseSpec(spec);
      const fn = () => generateServices(api, ['Tag']);
      expect(fn).toThrowError(`expected root-level 'x-kong-route-defaults' to be an object`);
    });

    it('ignores null for a root level x-kong-route-default', async () => {
      const spec = getSpec();
      spec[xKongRouteDefaults] = null;

      const specResult = getSpecResult();

      const api = await parseSpec(spec);
      expect(generateServices(api, ['Tag'])).toEqual([specResult]);
    });

    it('throws for a paths level x-kong-route-default', async () => {
      const spec = getSpec();
      spec.paths['/cats'][xKongRouteDefaults] = 'foo';

      const api = await parseSpec(spec);
      const fn = () => generateServices(api, ['Tag']);
      expect(fn).toThrowError(`expected 'x-kong-route-defaults' to be an object (at path '/cats')`);
    });

    it('ignores null for a paths level x-kong-route-default', async () => {
      const spec = getSpec();
      spec.paths['/cats'][xKongRouteDefaults] = null;

      const specResult = getSpecResult();

      const api = await parseSpec(spec);
      expect(generateServices(api, ['Tag'])).toEqual([specResult]);
    });

    it('throws for an operation level x-kong-route-default', async () => {
      const spec = getSpec();
      spec.paths['/cats'].post[xKongRouteDefaults] = 'foo';

      const api = await parseSpec(spec);
      const fn = () => generateServices(api, ['Tag']);
      expect(fn).toThrowError(
        `expected 'x-kong-route-defaults' to be an object (at operation 'post' of path '/cats')`,
      );
    });

    it('ignores null for an operation level x-kong-route-default', async () => {
      const spec = getSpec();
      spec.paths['/cats'].post[xKongRouteDefaults] = null;

      const specResult = getSpecResult();

      const api = await parseSpec(spec);
      expect(generateServices(api, ['Tag'])).toEqual([specResult]);
    });
  });

  describe('generateServices()', () => {
    it('generates generic service with paths', async () => {
      const spec = getSpec();

      const specResult = getSpecResult();

      const api = await parseSpec(spec);
      expect(generateServices(api, ['Tag'])).toEqual([specResult]);
    });

    it('generates routes with request validator plugin from operation over path over global', async () => {
      const spec = getSpec();

      // global req validator plugin
      spec[xKongPluginRequestValidator] = { config: { parameter_schema: 'global' } };

      // path req validator plugin
      spec.paths['/cats'][xKongPluginRequestValidator] = { config: { parameter_schema: 'path' } };
      spec.paths['/cats'].get = {};

      // operation req validator plugin
      spec.paths['/cats'].post[xKongPluginRequestValidator] = {
        config: { parameter_schema: 'operation' },
      };

      // operation req validator plugin
      spec.paths['/dogs'].post[xKongPluginRequestValidator] = {
        config: { parameter_schema: 'operation' },
      };

      const specResult = getSpecResult();
      specResult.plugins = [
        {
          config: { version: 'draft4', parameter_schema: 'global' },
          enabled: true,
          name: 'request-validator',
        },
      ];
      specResult.routes = [
        {
          tags: ['Tag'],
          name: 'My_API-Cat_stuff-post',
          methods: ['POST'],
          paths: ['/cats$'],
          strip_path: false,
          plugins: [
            {
              // should have operation plugin
              config: { version: 'draft4', parameter_schema: 'operation' },
              enabled: true,
              name: 'request-validator',
            },
          ],
        },
        {
          tags: ['Tag'],
          name: 'My_API-Cat_stuff-get',
          methods: ['GET'],
          paths: ['/cats$'],
          strip_path: false,
          plugins: [
            {
              // should apply path plugin
              config: { version: 'draft4', parameter_schema: 'path' },
              enabled: true,
              name: 'request-validator',
            },
          ],
        },
        {
          tags: ['Tag'],
          name: 'My_API-dogs-get',
          methods: ['GET'],
          paths: ['/dogs$'],
          strip_path: false,
          plugins: [
            {
              // should apply global plugin
              config: { version: 'draft4', parameter_schema: 'global' },
              enabled: true,
              name: 'request-validator',
            },
          ],
        },
        {
          tags: ['Tag'],
          name: 'My_API-dogs-post',
          methods: ['POST'],
          paths: ['/dogs$'],
          strip_path: false,
          plugins: [
            {
              // should have operation plugin
              config: { version: 'draft4', parameter_schema: 'operation' },
              enabled: true,
              name: 'request-validator',
            },
          ],
        },
        {
          tags: ['Tag'],
          name: 'My_API-birds_id-get',
          methods: ['GET'],
          paths: ['/birds/(?<id>[^\\/\\s]+)$'],
          strip_path: false,
          plugins: [
            {
              // should apply global plugin
              config: { version: 'draft4', parameter_schema: 'global' },
              enabled: true,
              name: 'request-validator',
            },
          ],
        },
      ];

      const api: OpenApi3Spec = await parseSpec(spec);
      expect(generateServices(api, ['Tag'])).toEqual([specResult]);
    });

    it('generates routes with plugins from operation over path', async () => {
      const spec = getSpec();
      spec.paths = {
        '/dogs': {
          summary: 'Dog stuff',
          'x-kong-plugin-key-auth': {
            config: {
              key_names: ['path'],
            },
          },
          get: {},
          post: {
            'x-kong-plugin-key-auth': {
              config: {
                key_names: ['operation'],
              },
            },
          },
        },
      };

      const specResult = getSpecResult();
      specResult.routes = [
        {
          name: 'My_API-dogs-get',
          strip_path: false,
          methods: ['GET'],
          paths: ['/dogs$'],
          tags: ['Tag'],
          plugins: [
            {
              name: 'key-auth',
              tags: ['Tag'],
              // should apply path plugin
              config: { key_names: ['path'] },
            },
          ],
        },
        {
          name: 'My_API-dogs-post',
          strip_path: false,
          methods: ['POST'],
          paths: ['/dogs$'],
          tags: ['Tag'],
          plugins: [
            {
              name: 'key-auth',
              tags: ['Tag'],
              // should apply path plugin
              config: { key_names: ['operation'] },
            },
          ],
        },
      ];

      const api: OpenApi3Spec = await parseSpec(spec);
      expect(generateServices(api, ['Tag'])).toEqual([specResult]);
    });

    it('replaces variables', async () => {
      const spec = getSpec();
      spec.servers = [
        {
          url: 'https://{customerId}.saas-app.com:{port}/v2',
          variables: {
            customerId: { default: 'demo' },
            port: { enum: ['443', '8443'], default: '8443' },
          },
        },
      ];

      const specResult = getSpecResult();
      specResult.port = 8443;
      specResult.path = '/v2';

      const api = await parseSpec(spec);
      expect(generateServices(api, ['Tag'])).toEqual([specResult]);
    });

    describe('x-kong-route-defaults and strip_path', () => {
      const rootLevel = {
        level: 'root',
        rootLevel: true,
      };

      const pathLevel = {
        level: 'path',
        pathLevel: true,
      };

      const operationLevel = {
        level: 'operation',
        operationLevel: true,
      };

      it('root level', async () => {
        const spec = getSpec();
        spec[xKongRouteDefaults] = rootLevel;

        const specResult = getSpecResult();
        specResult.routes = specResult.routes.map(route => ({
          ...route,
          ...rootLevel,
        }));

        const api = await parseSpec(spec);
        expect(generateServices(api, ['Tag'])).toEqual([specResult]);
      });

      it('path level', async () => {
        const spec = getSpec();
        spec.paths['/dogs'][xKongRouteDefaults] = pathLevel;

        const specResult = getSpecResult();
        specResult.routes[1] = {
          ...specResult.routes[1],
          ...pathLevel,
        };
        specResult.routes[2] = {
          ...specResult.routes[2],
          ...pathLevel,
        };

        const api = await parseSpec(spec);
        expect(generateServices(api, ['Tag'])).toEqual([specResult]);
      });

      it('operation level', async () => {
        const spec = getSpec();
        spec.paths['/dogs'].get[xKongRouteDefaults] = operationLevel;

        const specResult = getSpecResult();
        specResult.routes[1] = {
          ...specResult.routes[1],
          ...operationLevel,
        };

        const api = await parseSpec(spec);
        expect(generateServices(api, ['Tag'])).toEqual([specResult]);
      });

      it('will select (but not merge) the operation level over the root level', async () => {
        const spec = getSpec();

        spec[xKongRouteDefaults] = rootLevel;
        spec.paths['/cats'].post[xKongRouteDefaults] = operationLevel;

        const specResult = getSpecResult();
        specResult.routes = specResult.routes.map(route => ({
          ...route,
          // $FlowFixMe
          ...(route.paths[0] === '/cats$' ? operationLevel : rootLevel),
        }));

        const api = await parseSpec(spec);
        expect(generateServices(api, ['Tag'])).toEqual([specResult]);
      });

      it('will select (but not merge) the operation level over the path level', async () => {
        const spec = getSpec();

        spec.paths['/dogs'][xKongRouteDefaults] = pathLevel;
        spec.paths['/dogs'].post[xKongRouteDefaults] = operationLevel;

        const specResult = getSpecResult();
        specResult.routes[1] = {
          ...specResult.routes[1],
          ...pathLevel,
        };
        specResult.routes[2] = {
          ...specResult.routes[2],
          ...operationLevel,
        };

        const api = await parseSpec(spec);
        expect(generateServices(api, ['Tag'])).toEqual([specResult]);
      });

      it('will select (but not merge) the path level over the root level', async () => {
        const spec = getSpec();
        spec[xKongRouteDefaults] = rootLevel;
        spec.paths['/cats'][xKongRouteDefaults] = pathLevel;

        const specResult = getSpecResult();
        specResult.routes = specResult.routes.map(route => ({
          ...route,
          // $FlowFixMe
          ...(route.paths[0] === '/cats$' ? pathLevel : rootLevel),
        }));

        const api = await parseSpec(spec);
        expect(generateServices(api, ['Tag'])).toEqual([specResult]);
      });

      it('allows overriding strip_path at the path level', async () => {
        const spec = getSpec();
        spec.paths['/cats'][xKongRouteDefaults] = { strip_path: true };

        const specResult = getSpecResult();
        const cats = specResult.routes.find(route => route.paths[0] === '/cats$');
        cats.strip_path = true;

        const api = await parseSpec(spec);
        expect(generateServices(api, ['Tag'])).toEqual([specResult]);
      });

      it('allows overriding `strip_path` from `x-kong-route-defaults` at the root', async () => {
        const spec = getSpec();
        spec[xKongRouteDefaults] = { strip_path: true };

        const specResult = getSpecResult();
        specResult.routes = specResult.routes.map(route => ({
          ...route,
          strip_path: true,
        }));

        const api = await parseSpec(spec);
        expect(generateServices(api, ['Tag'])).toEqual([specResult]);
      });
    });
  });
});
