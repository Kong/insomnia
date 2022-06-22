import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { OpenAPIV3 } from 'openapi-types';

import { HttpMethod } from '../common';
import { dummyPluginDoc, pluginDummy } from '../declarative-config/jest/test-helpers';
import { IndexIncrement, OperationPlugin, PathPlugin } from '../types/k8s-plugins';
import {
  OA3Components,
  OA3Operation,
  OA3PathItem,
  OA3Paths,
  OA3Server,
  OpenApi3Spec,
} from '../types/openapi3';
import {
  keyAuthPluginDoc,
  pluginDocWithName,
  pluginKeyAuth,
} from './plugin-helpers';
import {
  flattenPluginDocuments,
  generateK8sPluginConfig,
  getGlobalPlugins,
  getOperationPlugins,
  getPathPlugins,
  getPlugins,
  getServerPlugins,
  normalizeOperationPlugins,
  normalizePathPlugins,
  prioritizePlugins,
} from './plugins';

describe('plugins', () => {
  let _iterator = 0;

  const increment = () => _iterator++;

  const blankOperation = {
    method: null,
    plugins: [],
  };

  const blankPath = {
    path: '',
    plugins: [],
    operations: [blankOperation],
  };

  const spec: OpenApi3Spec = {
    openapi: '3.0',
    info: {
      version: '1.0',
      title: 'My API',
    },
    servers: [
      {
        url: 'http://api.insomnia.rest',
      },
    ],
    paths: {},
  };

  const components: OA3Components = {
    securitySchemes: {
      really_basic: {
        type: 'http',
        scheme: 'basic',
      },
      my_api_key: {
        type: 'apiKey',
        name: 'api_key_by_me',
        in: 'header',
      },
      your_api_key: {
        type: 'apiKey',
        name: 'api_key_by_you',
        in: 'header',
      },
      petstore_oauth2: {
        type: 'oauth2',
        flows: {
          clientCredentials: {
            tokenUrl: 'http://example.org/api/oauth/dialog',
            scopes: {
              'write:pets': 'modify pets in your account',
              'read:pets': 'read your pets',
            },
          },
        },
      },
      petstore_openid: {
        type: 'openIdConnect',
        openIdConnectUrl: 'http://example.org/oid-discovery',
      },
    },
  };

  beforeEach(() => {
    _iterator = 0;
  });

  describe('getPlugins()', () => {
    it('should return expected result if no plugins on spec', () => {
      const result = getPlugins(spec);
      const globalPlugins = result.global;
      expect(globalPlugins).toHaveLength(0);
      expect(result.servers).toEqual([
        {
          server: spec.servers?.[0],
          plugins: [],
        },
      ]);
      expect(result.paths).toEqual([blankPath]);
    });

    it('should return expected result if plugins on global, server, path, and operation', () => {
      const api: OpenApi3Spec = {
        ...spec,
        ...pluginKeyAuth,
        servers: [
          {
            url: 'http://api.insomnia.rest',
            ...pluginKeyAuth,
          },
        ],
        paths: {
          '/path': {
            ...pluginKeyAuth,
            get: {
              ...pluginKeyAuth,
            },
          },
        },
      };
      const result = getPlugins(api);
      const globalPlugins = result.global;
      expect(globalPlugins).toEqual([keyAuthPluginDoc('g0')]);
      const serverPlugins = result.servers[0].plugins;
      expect(serverPlugins).toEqual([keyAuthPluginDoc('s1')]);
      const pathPlugins = result.paths[0].plugins;
      expect(pathPlugins).toEqual([keyAuthPluginDoc('p2')]);
      const operationPlugins = result.paths[0].operations[0].plugins;
      expect(operationPlugins).toEqual([keyAuthPluginDoc('m3')]);
    });

    it('should throw error if no servers on api', () => {
      const action = () => getPlugins({ ...spec, servers: [] });

      expect(action).toThrowError('Failed to generate spec: no servers defined in spec.');
    });
  });

  describe('getGlobalPlugins()', () => {
    it('returns empty array if no global plugins found on spec', async () => {
      const result = getGlobalPlugins(spec, increment);
      expect(result).toHaveLength(0);
    });

    it('returns single plugin doc', () => {
      const api: OpenApi3Spec = { ...spec, ...pluginKeyAuth };
      const result = getGlobalPlugins(api, increment);
      expect(result).toEqual([keyAuthPluginDoc('g0')]);
    });

    it('returns multiple plugin docs', () => {
      const api: OpenApi3Spec = { ...spec, ...pluginKeyAuth, ...pluginDummy };
      const result = getGlobalPlugins(api, increment);
      expect(result).toEqual([keyAuthPluginDoc('g0'), dummyPluginDoc('g1')]);
    });

    it('returns security plugin doc', () => {
      const pluginSecurity = {
        security: [
          {
            really_basic: [],
            your_api_key: [],
          },
        ],
        components: {
          securitySchemes: {
            really_basic: {
              type: 'http',
              scheme: 'basic',
            },
            my_api_key: {
              type: 'apiKey',
              name: 'api_key_by_me',
              in: 'header',
            },
            your_api_key: {
              type: 'apiKey',
              name: 'api_key_by_you',
              in: 'header',
            },
            petstore_oauth2: {
              type: 'oauth2',
              flows: {
                clientCredentials: {
                  tokenUrl: 'http://example.org/api/oauth/dialog',
                  scopes: {
                    'write:pets': 'modify pets in your account',
                    'read:pets': 'read your pets',
                  },
                },
              },
            },
            petstore_openid: {
              type: 'openIdConnect',
              openIdConnectUrl: 'http://example.org/oid-discovery',
            },
          },
        },
      };
      const api: OpenApi3Spec = {
        ...spec,
        ...pluginDummy,
        ...pluginSecurity,
        components,
      };
      const result = getGlobalPlugins(api, increment);
      expect(result).toEqual([
        dummyPluginDoc('g0'),
        {
          apiVersion: 'configuration.konghq.com/v1',
          kind: 'KongPlugin',
          plugin: 'basic-auth',
          metadata: {
            name: 'add-basic-auth-g1',
          },
        },
        {
          apiVersion: 'configuration.konghq.com/v1',
          kind: 'KongPlugin',
          plugin: 'key-auth',
          metadata: {
            name: 'add-key-auth-g2',
          },
          config: {
            key_names: ['api_key_by_you'],
          },
        },
      ]);
    });
  });

  describe('getServerPlugins()', () => {
    const server0: OA3Server = {
      url: 'http://api-0.insomnia.rest',
    };
    const server1: OA3Server = {
      url: 'http://api-1.insomnia.rest',
    };

    it('returns no plugins for servers', () => {
      const servers = [server0, server1];
      const result = getServerPlugins(servers, increment);
      expect(result).toHaveLength(2);
      result.forEach(s => expect(s.plugins).toHaveLength(0));
    });

    it('returns plugins from each server', () => {
      const servers = [{ ...server0 }, { ...server1, ...pluginKeyAuth, ...pluginDummy }];
      const result = getServerPlugins(servers, increment);
      expect(result).toHaveLength(2);
      expect(result[0].plugins).toEqual([]);
      expect(result[1].plugins).toEqual([keyAuthPluginDoc('s0'), dummyPluginDoc('s1')]);
    });
  });

  describe('getPathPlugins()', () => {
    it('should return normalized result if no paths', () => {
      const paths: OA3Paths = {};
      const result = getPathPlugins(paths, increment, spec);
      expect(result).toEqual([blankPath]);
    });

    it('should return normalized result if no path and operation plugins', () => {
      const paths: OA3Paths = {
        '/path': {
          description: 'path',
          get: {
            description: 'get',
          },
        },
      };
      const result = getPathPlugins(paths, increment, spec);
      expect(result).toEqual([blankPath]);
    });

    it('should handle plugins existing on path', () => {
      const paths: OA3Paths = {
        '/path-no-plugin': {},
        '/path': pluginDummy as OA3PathItem,
      };
      const result = getPathPlugins(paths, increment, spec);
      expect(result).toHaveLength(2);
      const first = result[0];
      expect(first.path).toBe('/path-no-plugin');
      expect(first.plugins).toHaveLength(0);
      expect(first.operations).toEqual([blankOperation]);
      const second = result[1];
      expect(second.path).toBe('/path');
      expect(second.plugins).toEqual([dummyPluginDoc('p0')]);
      expect(second.operations).toEqual([blankOperation]);
    });

    it('should handle plugins existing on operation and not on path', () => {
      const paths: OA3Paths = {
        '/path': {
          get: pluginDummy as OA3Operation,
          put: {},
        },
      };
      const result = getPathPlugins(paths, increment, spec);
      expect(result).toHaveLength(1);
      expect(result[0].plugins).toHaveLength(0);
      expect(result[0].operations).toEqual([
        {
          method: 'get',
          plugins: [dummyPluginDoc('m0')],
        },
        {
          method: 'put',
          plugins: [],
        },
      ]);
    });

    it('should handle plugins existing on path and operation', () => {
      const paths: OA3Paths = {
        '/path-0': { ...pluginKeyAuth, get: pluginDummy as OA3Operation },
        '/path-1': { ...pluginDummy, put: {} },
      };
      const result = getPathPlugins(paths, increment, spec);
      expect(result).toHaveLength(2);
      const path0 = result[0];
      expect(path0.path).toBe('/path-0');
      expect(path0.plugins).toEqual([keyAuthPluginDoc('p0')]);
      expect(path0.operations).toEqual([
        {
          method: 'get',
          plugins: [dummyPluginDoc('m1')],
        },
      ]);
      const path1 = result[1];
      expect(path1.path).toBe('/path-1');
      expect(path1.plugins).toEqual([dummyPluginDoc('p2')]);
      expect(path1.operations).toEqual([blankOperation]);
    });
  });

  describe('getOperationPlugins()', () => {
    it('should return normalized result if no plugins', () => {
      const pathItem = {
        description: 'test',
      };
      const result = getOperationPlugins(pathItem, increment, spec);
      expect(result).toEqual([blankOperation]);
    });

    it('should return plugins for all operations on path', () => {
      const pathItem: OA3PathItem = {
        get: {},
        put: { ...pluginKeyAuth, ...pluginDummy },
        post: pluginDummy as OA3Operation,
      };
      const result = getOperationPlugins(pathItem, increment, spec);
      expect(result).toHaveLength(3);
      const get = result[0];
      expect(get.method).toBe('get');
      expect(get.plugins).toHaveLength(0);
      const put = result[1];
      expect(put.method).toBe('put');
      expect(put.plugins).toEqual([keyAuthPluginDoc('m0'), dummyPluginDoc('m1')]);
      const post = result[2];
      expect(post.method).toBe('post');
      expect(post.plugins).toEqual([dummyPluginDoc('m2')]);
    });

    it.each(Object.values(OpenAPIV3.HttpMethods))(
      'should extract method plugins for %o from path item',
      methodName => {
        const pathItem = {
          [methodName]: { ...pluginKeyAuth, ...pluginDummy },
        };
        const result = getOperationPlugins(pathItem, increment, spec);
        expect(result).toHaveLength(1);
        const first = result[0];
        expect(first.method).toBe(methodName);
        expect(first.plugins).toEqual([keyAuthPluginDoc('m0'), dummyPluginDoc('m1')]);
      },
    );

    it('should return security plugin from operation', () => {
      const api: OpenApi3Spec = { ...spec, components };
      const pathItem: OA3PathItem = {
        'get': {
          security: [
            {
              really_basic: [],
              your_api_key: [],
            },
          ],
        },
      };
      const result = getOperationPlugins(pathItem, increment, api);
      expect(result[0].plugins).toEqual([
        {
          apiVersion: 'configuration.konghq.com/v1',
          kind: 'KongPlugin',
          plugin: 'basic-auth',
          metadata: {
            name: 'add-basic-auth-m0',
          },
        },
        {
          apiVersion: 'configuration.konghq.com/v1',
          kind: 'KongPlugin',
          plugin: 'key-auth',
          metadata: {
            name: 'add-key-auth-m1',
          },
          config: {
            key_names: ['api_key_by_you'],
          },
        },
      ]);
    });
  });

  describe('generateK8sPluginConfig()', () => {
    it('should return empty array if no plugin keys found and not increment', () => {
      const incrementMock = jest.fn<IndexIncrement>().mockReturnValue(0);
      const result = generateK8sPluginConfig(spec, 's', incrementMock);
      expect(result).toHaveLength(0);
      expect(incrementMock).not.toHaveBeenCalled();
    });

    it('should attach config onto plugin if it exists and increment', () => {
      const incrementMock = jest.fn().mockReturnValue(0);
      // @ts-expect-error -- TSCONVERSION not sure, but this is intentionally different maybe?
      const result = generateK8sPluginConfig({ ...spec, ...pluginKeyAuth }, 'greg', incrementMock);
      expect(result).toEqual([keyAuthPluginDoc('greg0')]);
      expect(incrementMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('normalizePathPlugins()', () => {
    it('should return source array if a path with plugins exists', () => {
      const source: PathPlugin[] = [
        {
          path: '/path-with-plugin',
          // @ts-expect-error -- TSCONVERSION more work is needed to module augment to include DummyPlugin (but not export those augmentations)
          plugins: [dummyPluginDoc('p0')],
          operations: [blankOperation],
        },
        {
          path: '/path',
          plugins: [],
          operations: [blankOperation],
        },
      ];
      expect(normalizePathPlugins(source)).toEqual(source);
    });

    it('should return source array if an operation with plugins exist', () => {
      const source: PathPlugin[] = [
        {
          path: '/path',
          plugins: [],
          operations: [
            {
              method: HttpMethod.get,
              // @ts-expect-error -- TSCONVERSION more work is needed to module augment to include DummyPlugin (but not export those augmentations)
              plugins: [dummyPluginDoc('p0')],
            },
            {
              method: HttpMethod.put,
              plugins: [],
            },
          ],
        },
      ];
      expect(normalizePathPlugins(source)).toEqual(source);
    });

    it('should return blank path if no plugins exist on path or operations', () => {
      const source: PathPlugin[] = [
        {
          path: '/path-0',
          plugins: [],
          operations: [blankOperation],
        },
        {
          path: '/path-1',
          plugins: [],
          operations: [blankOperation],
        },
      ];
      expect(normalizePathPlugins(source)).toEqual([blankPath]);
    });
  });

  describe('normalizeOperationPlugins()', () => {
    it('should return source array if operation plugins exist', () => {
      const source: OperationPlugin[] = [
        {
          method: HttpMethod.get,
          plugins: [],
        },
        {
          method: HttpMethod.post,
          // @ts-expect-error -- TSCONVERSION more work is needed to module augment to include DummyPlugin (but not export those augmentations)
          plugins: [dummyPluginDoc('p0')],
        },
      ];
      expect(normalizeOperationPlugins(source)).toEqual(source);
    });

    it('should return blank operation if no plugins exist on operations', () => {
      const source: OperationPlugin[] = [
        {
          method: HttpMethod.get,
          plugins: [],
        },
        {
          method: HttpMethod.post,
          plugins: [],
        },
      ];
      expect(normalizeOperationPlugins(source)).toEqual([blankOperation]);
    });
  });

  describe('flattenPluginDocuments()', () => {
    it('should return a flat array with all plugin documents', () => {
      const api: OpenApi3Spec = {
        ...spec,
        ...pluginKeyAuth,
        servers: [
          {
            url: 'http://api.insomnia.rest',
            ...pluginKeyAuth,
          },
        ],
        paths: {
          '/path': { ...pluginKeyAuth, get: { ...pluginKeyAuth } },
        },
      };
      const plugins = getPlugins(api);
      const flattened = flattenPluginDocuments(plugins);
      expect(flattened).toEqual([
        keyAuthPluginDoc('g0'),
        keyAuthPluginDoc('s1'),
        keyAuthPluginDoc('p2'),
        keyAuthPluginDoc('m3'),
      ]);
    });
  });

  describe('prioritizePlugins', () => {
    it('should return empty array if no plugins', () => {
      const result = prioritizePlugins([], [], [], []);
      expect(result).toHaveLength(0);
    });

    it('should return all plugins if no two plugins are the same type', () => {
      const p1 = pluginDocWithName('p1', 'custom-plugin-1');
      const p2 = pluginDocWithName('p2', 'custom-plugin-2');
      const p3 = pluginDocWithName('p3', 'custom-plugin-3');
      const p4 = pluginDocWithName('p4', 'custom-plugin-4');
      const global = [p1];
      const server = [p2];
      const path = [p3];
      const operation = [p4];
      const result = prioritizePlugins(global, server, path, operation);
      expect(result).toEqual([...operation, ...path, ...server, ...global]);
    });

    it('should return operation plugin if same type exists in path, server and global', () => {
      const pluginType = 'custom-plugin';
      const p1 = pluginDocWithName('p1', pluginType);
      const p2 = pluginDocWithName('p2', pluginType);
      const p3 = pluginDocWithName('p3', pluginType);
      const p4 = pluginDocWithName('p4', pluginType);
      const global = [p1];
      const server = [p2];
      const path = [p3];
      const operation = [p4];
      const result = prioritizePlugins(global, server, path, operation);
      expect(result).toEqual([...operation]);
    });

    it('should return path plugin if same type exists in server and global', () => {
      const pluginType = 'custom-plugin';
      const p1 = pluginDocWithName('p1', pluginType);
      const p2 = pluginDocWithName('p2', pluginType);
      const p3 = pluginDocWithName('p3', pluginType);
      const global = [p1];
      const server = [p2];
      const path = [p3];
      const result = prioritizePlugins(global, server, path, []);
      expect(result).toEqual([...path]);
    });

    it('should return server plugin if same type exists in global', () => {
      const pluginType = 'custom-plugin';
      const p1 = pluginDocWithName('p1', pluginType);
      const p2 = pluginDocWithName('p2', pluginType);
      const global = [p1];
      const server = [p2];
      const result = prioritizePlugins(global, server, [], []);
      expect(result).toEqual([...server]);
    });

    it('should prioritize as expected', () => {
      const typeG = 'custom-plugin-1';
      const typeS = 'custom-plugin-2';
      const typeP = 'custom-plugin-3';
      const typeO = 'custom-plugin-4';
      // Note: the variable naming below is [applied-to][resolved-from]
      // IE: po implies it is applied to a path, but that plugin type should be resolved by the operation
      // Therefore, the result should only contain gg, ss, pp and oo. The others are duplicates
      // of the same plugin type and should be filtered out due to prioritization.
      const gg = pluginDocWithName('gg', typeG);
      const gs = pluginDocWithName('gs', typeS);
      const ss = pluginDocWithName('ss', typeS);
      const gp = pluginDocWithName('gp', typeP);
      const sp = pluginDocWithName('sp', typeP);
      const pp = pluginDocWithName('pp', typeP);
      const go = pluginDocWithName('go', typeO);
      const so = pluginDocWithName('so', typeO);
      const po = pluginDocWithName('po', typeO);
      const oo = pluginDocWithName('oo', typeO);
      const global = [gg, gs, gp, go];
      const server = [ss, sp, so];
      const path = [pp, po];
      const operation = [oo];
      const result = prioritizePlugins(global, server, path, operation);
      expect(result).toEqual([oo, pp, ss, gg]);
    });
  });
});
