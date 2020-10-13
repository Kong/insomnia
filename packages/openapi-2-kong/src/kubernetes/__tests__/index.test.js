// @flow
import { parseSpec } from '../../index';
import {
  generateKongForKubernetesConfigFromSpec,
  generateMetadataAnnotations,
  getSpecName,
  generateRulesForServer,
  generateServiceName,
  generateServicePath,
  generateServicePort,
} from '../index';
import {
  dummyName,
  dummyPluginDoc,
  ingressDoc,
  ingressDocWithOverride,
  keyAuthName,
  keyAuthPluginDoc,
  methodDoc,
  pluginDummy,
  pluginKeyAuth,
} from './util/plugin-helpers';

describe('index', () => {
  const spec = {
    openapi: '3.0',
    info: { version: '1.0', title: 'My API' },
    servers: [
      {
        url: 'http://api.insomnia.rest',
      },
    ],
    paths: {},
  };

  describe('getSpecName()', () => {
    it('with info.title', async () => {
      const api: OpenApi3Spec = await parseSpec({ ...spec });
      expect(getSpecName(api)).toBe('my-api');
    });

    it('no name', async () => {
      const api: OpenApi3Spec = await parseSpec({ ...spec, info: undefined });
      expect(getSpecName(api)).toBe('openapi');
    });

    it('with x-kong-name', () => {
      const api: OpenApi3Spec = { ...spec, 'x-kong-name': 'kong-name' };

      expect(getSpecName(api)).toBe('kong-name');
    });

    it('with x-kubernetes-ingress-metadata.name', async () => {
      const api: OpenApi3Spec = await parseSpec({
        ...spec,
        'x-kong-name': 'Kong Name',
        info: {
          'x-kubernetes-ingress-metadata': {
            name: 'K8s name',
          },
        },
      });
      expect(getSpecName(api)).toBe('k8s-name');
    });
  });

  describe('generateMetadataAnnotations()', () => {
    it('gets annotations from x-kubernetes-ingress-metadata', async () => {
      const api: OpenApi3Spec = await parseSpec({
        ...spec,
        info: {
          'x-kubernetes-ingress-metadata': {
            name: 'info-name',
            annotations: {
              'nginx.ingress.kubernetes.io/rewrite-target': '/',
            },
          },
        },
      });

      const result = generateMetadataAnnotations(api, { pluginNames: [] });

      expect(result).toEqual({
        'kubernetes.io/ingress.class': 'kong',
        'nginx.ingress.kubernetes.io/rewrite-target': '/',
      });
    });

    it('gets only core annotation(s)', () => {
      const result = generateMetadataAnnotations(spec, { pluginNames: [] });
      expect(result).toEqual({ 'kubernetes.io/ingress.class': 'kong' });
    });

    it('gets plugin annotations correctly', () => {
      const result = generateMetadataAnnotations(spec, { pluginNames: ['one', 'two'] });
      expect(result).toEqual({
        'kubernetes.io/ingress.class': 'kong',
        'konghq.com/plugins': 'one, two',
      });
    });

    it('gets override annotation correctly', () => {
      const result = generateMetadataAnnotations(spec, { pluginNames: [], overrideName: 'name' });
      expect(result).toEqual({
        'kubernetes.io/ingress.class': 'kong',
        'konghq.com/override': 'name',
      });
    });

    it('gets all annotations correctly', () => {
      const originalAnnotations = {
        'nginx.ingress.kubernetes.io/rewrite-target': '/',
      };

      const api: OpenApi3Spec = {
        ...spec,
        info: {
          ...spec.info,
          'x-kubernetes-ingress-metadata': {
            name: 'info-name',
            annotations: { ...originalAnnotations },
          },
        },
      };
      const result = generateMetadataAnnotations(api, {
        pluginNames: ['one', 'two'],
        overrideName: 'name',
      });
      expect(result).toEqual({
        'kubernetes.io/ingress.class': 'kong',
        'nginx.ingress.kubernetes.io/rewrite-target': '/',
        'konghq.com/plugins': 'one, two',
        'konghq.com/override': 'name',
      });

      // Should not modify source metadata annotations object
      expect(api.info['x-kubernetes-ingress-metadata']?.annotations).toStrictEqual(
        originalAnnotations,
      );
    });
  });

  describe('generateServiceName()', () => {
    it('defaults to ingress name', () => {
      const server: OA3Server = { url: 'https://insomnia.rest' };
      expect(generateServiceName(server, 'my-api', 0)).toBe('my-api-service-0');
      expect(generateServiceName(server, 'my-api', 3)).toBe('my-api-service-3');
    });

    it('uses x-kubernetes-backend.serviceName', () => {
      const server: OA3Server = {
        url: 'https://insomnia.rest',
        'x-kubernetes-backend': {
          serviceName: 'b-name',
          servicePort: 123,
        },
      };
      expect(generateServiceName(server, 'my-api', 0)).toBe('b-name');
    });

    it('uses x-kubernetes-service.metadata.name', () => {
      const server = {
        url: 'https://insomnia.rest',
        'x-kubernetes-service': {
          metadata: {
            name: 's-name',
          },
        },
      };
      expect(generateServiceName(server, 'my-api', 0)).toBe('s-name');
    });
  });

  describe('generateServicePort()', () => {
    it('uses default 80 for http and https', () => {
      const server = { url: 'http://api.insomnia.rest' };
      expect(generateServicePort(server)).toEqual(80);
      server.url = 'https://api.insomnia.rest';
      expect(generateServicePort(server)).toEqual(80);
    });

    it('uses default 443 when tls configured ', () => {
      const server = {
        url: 'https://api.insomnia.rest',
        'x-kubernetes-tls': { secretName: 'tls-secret' },
      };
      expect(generateServicePort(server)).toEqual(443);
    });

    it('uses 443 if any port is 443 when tls configured ', () => {
      const server: OA3Server = {
        url: 'https://api.insomnia.rest',
        'x-kubernetes-tls': { secretName: 'tls-secret' },
        'x-kubernetes-service': {
          spec: {
            ports: [{ port: 212 }, { port: 443 }],
          },
        },
      };
      expect(generateServicePort(server)).toEqual(443);
    });

    it('uses x-kubernetes-backend.servicePort', () => {
      const server: OA3Server = {
        url: 'https://api.insomnia.rest',
        'x-kubernetes-backend': {
          serviceName: 'b-name',
          servicePort: 123,
        },
        'x-kubernetes-service': {
          spec: {
            ports: [{ port: 212 }, { port: 322 }],
          },
        },
      };
      expect(generateServicePort(server)).toEqual(123);
    });

    it('uses first port', () => {
      const server = {
        url: 'https://api.insomnia.rest',
        'x-kubernetes-service': {
          spec: {
            ports: [{ port: 212 }, { port: 322 }],
          },
        },
      };
      expect(generateServicePort(server)).toEqual(212);
    });
  });

  describe('generateServicePath()', () => {
    it.each(['', '/'])(
      'returns undefined if base path is [%o] and no specific path exists',
      serverBasePath => {
        expect(generateServicePath(serverBasePath)).toBe(undefined);
      },
    );

    it.each(['/api/v1', '/api/v1/'])('adds closing wildcard if base path is [%o]', basePath => {
      expect(generateServicePath(basePath)).toBe('/api/v1/.*');
    });

    it('adds closing wildcard if basePath ends with wildcard and no specific path exists', () => {
      const serverBasePath = '/api/.*';
      expect(generateServicePath(serverBasePath)).toBe('/api/.*/.*');
    });

    it.each(['/', '/specificPath'])(
      'does not add closing wildcard if using specific path: [%o]',
      specificPath => {
        const serverBasePath = '/';
        const result = generateServicePath(serverBasePath, specificPath);
        expect(result).toBe(specificPath);
      },
    );

    it('converts path variables to .* wildcards', () => {
      const serverBasePath = '/api/v1';
      const result = generateServicePath(serverBasePath, '/{var}/{another-var}/path');
      expect(result).toBe('/api/v1/.*/.*/path');
    });
  });

  describe('generateRulesForServer()', () => {
    it('handles basic server at root', () => {
      const result = generateRulesForServer(0, { url: 'http://api.insomnia.rest' }, 'my-ingress');

      expect(result).toStrictEqual({
        host: 'api.insomnia.rest',
        http: {
          paths: [
            {
              backend: {
                serviceName: 'my-ingress-service-0',
                servicePort: 80,
              },
            },
          ],
        },
      });
    });

    it('handles basic server with base path', () => {
      const result = generateRulesForServer(
        0,
        { url: 'http://api.insomnia.rest/v1' },
        'my-ingress',
      );

      expect(result).toEqual({
        host: 'api.insomnia.rest',
        http: {
          paths: [
            {
              path: '/v1/.*',
              backend: {
                serviceName: 'my-ingress-service-0',
                servicePort: 80,
              },
            },
          ],
        },
      });
    });

    it('handles server with specific path', () => {
      const result = generateRulesForServer(
        1,
        { url: 'http://api.insomnia.rest/v1' },
        'my-ingress',
        ['/{parameter}/{another}/path'],
      );

      expect(result).toEqual({
        host: 'api.insomnia.rest',
        http: {
          paths: [
            {
              path: '/v1/.*/.*/path',
              backend: {
                serviceName: 'my-ingress-service-1',
                servicePort: 80,
              },
            },
          ],
        },
      });
    });

    it('handles server with no paths', () => {
      const result = generateRulesForServer(
        1,
        { url: 'http://api.insomnia.rest/v1' },
        'my-ingress',
        [],
      );

      expect(result).toEqual({
        host: 'api.insomnia.rest',
        http: {
          paths: [
            {
              path: '/v1/.*',
              backend: {
                serviceName: 'my-ingress-service-1',
                servicePort: 80,
              },
            },
          ],
        },
      });
    });

    it('handles TLS', () => {
      const result = generateRulesForServer(
        0,
        {
          url: 'http://api.insomnia.rest/v1',
          'x-kubernetes-tls': {
            secretName: 'my-secret',
          },
        },
        'my-ingress',
      );

      expect(result).toEqual({
        host: 'api.insomnia.rest',
        tls: {
          paths: [
            {
              path: '/v1/.*',
              backend: {
                serviceName: 'my-ingress-service-0',
                servicePort: 443,
              },
            },
          ],
          secretName: 'my-secret',
        },
      });
    });

    it('handles server url with protocol variable - no default', () => {
      const server = { url: '{protocol}://api.insomnia.rest/v1' };
      const result = generateRulesForServer(1, server, 'my-ingress', []);

      expect(result).toEqual({
        host: 'api.insomnia.rest',
        http: {
          paths: [
            {
              path: '/v1/.*',
              backend: {
                serviceName: 'my-ingress-service-1',
                servicePort: 80,
              },
            },
          ],
        },
      });

      expect(server.url).toBe('http://api.insomnia.rest/v1');
    });

    it('handles server url with protocol variable - with default', () => {
      const server = {
        url: '{protocol}://api.insomnia.rest/v1',
        variables: { protocol: { default: 'https' } },
      };
      const result = generateRulesForServer(1, server, 'my-ingress', []);

      expect(result).toEqual({
        host: 'api.insomnia.rest',
        http: {
          paths: [
            {
              path: '/v1/.*',
              backend: {
                serviceName: 'my-ingress-service-1',
                servicePort: 80,
              },
            },
          ],
        },
      });

      expect(server.url).toBe('https://api.insomnia.rest/v1');
    });

    it('handles server url with path variables', () => {
      const server: OA3Server = {
        url: '{protocol}://api.insomnia.rest/{route}/{version}',
        variables: {
          version: {
            default: 'v1',
          },
        },
      };
      const result = generateRulesForServer(1, server, 'my-ingress', []);

      expect(result).toEqual({
        host: 'api.insomnia.rest',
        http: {
          paths: [
            {
              path: '/.*/v1/.*',
              backend: {
                serviceName: 'my-ingress-service-1',
                servicePort: 80,
              },
            },
          ],
        },
      });

      expect(server.url).toBe('http://api.insomnia.rest/.*/v1');
    });
  });

  describe('generateKongForKubernetesConfigFromSpec()', () => {
    it('handles global plugins', async () => {
      const api: OpenApi3Spec = await parseSpec({
        ...spec,
        ...pluginKeyAuth,
        ...pluginDummy,
      });

      const result = generateKongForKubernetesConfigFromSpec(api, []);

      expect(result.documents).toStrictEqual([
        keyAuthPluginDoc('g0'),
        dummyPluginDoc('g1'),
        ingressDoc(
          0,
          [keyAuthName('g0'), dummyName('g1')],
          'api.insomnia.rest',
          'my-api-service-0',
        ),
      ]);
    });

    it('handles global and server plugins', async () => {
      const api: OpenApi3Spec = await parseSpec({
        ...spec,
        ...pluginKeyAuth,
        servers: [
          {
            url: 'http://api-0.insomnia.rest',
          },
          {
            url: 'http://api-1.insomnia.rest',
            ...pluginKeyAuth,
          },
          {
            url: 'http://api-2.insomnia.rest',
            ...pluginKeyAuth,
            ...pluginDummy,
          },
        ],
      });

      const result = generateKongForKubernetesConfigFromSpec(api, []);

      expect(result.documents).toStrictEqual([
        keyAuthPluginDoc('g0'),
        keyAuthPluginDoc('s1'),
        keyAuthPluginDoc('s2'),
        dummyPluginDoc('s3'),
        ingressDoc(0, [keyAuthName('g0')], 'api-0.insomnia.rest', 'my-api-service-0'),
        ingressDoc(1, [keyAuthName('s1')], 'api-1.insomnia.rest', 'my-api-service-1'),
        ingressDoc(
          2,
          [keyAuthName('s2'), dummyName('s3')],
          'api-2.insomnia.rest',
          'my-api-service-2',
        ),
      ]);
    });

    it('handles global and path plugins', async () => {
      const api: OpenApi3Spec = await parseSpec({
        ...spec,
        ...pluginKeyAuth,
        paths: {
          '/no-plugin': {},
          '/plugin-0': {
            ...pluginKeyAuth,
          },
          '/plugin-1': {
            ...pluginKeyAuth,
            ...pluginDummy,
          },
        },
      });

      const result = generateKongForKubernetesConfigFromSpec(api, []);

      expect(result.documents).toStrictEqual([
        keyAuthPluginDoc('g0'),
        keyAuthPluginDoc('p1'),
        keyAuthPluginDoc('p2'),
        dummyPluginDoc('p3'),
        ingressDoc(0, [keyAuthName('g0')], 'api.insomnia.rest', 'my-api-service-0', '/no-plugin'),
        ingressDoc(1, [keyAuthName('p1')], 'api.insomnia.rest', 'my-api-service-0', '/plugin-0'),
        ingressDoc(
          2,
          [keyAuthName('p2'), dummyName('p3')],
          'api.insomnia.rest',
          'my-api-service-0',
          '/plugin-1',
        ),
      ]);
    });

    it('handles global and method plugins', async () => {
      const api: OpenApi3Spec = await parseSpec({
        ...spec,
        ...pluginKeyAuth,
        paths: {
          '/path': {
            GET: {},
            PUT: {
              ...pluginKeyAuth,
            },
            POST: {
              ...pluginKeyAuth,
              ...pluginDummy,
            },
          },
        },
      });

      const result = generateKongForKubernetesConfigFromSpec(api, []);

      expect(result.documents).toStrictEqual([
        methodDoc('get'),
        methodDoc('put'),
        methodDoc('post'),
        keyAuthPluginDoc('g0'),
        keyAuthPluginDoc('m1'),
        keyAuthPluginDoc('m2'),
        dummyPluginDoc('m3'),
        ingressDocWithOverride(
          0,
          [keyAuthName('g0')],
          'get-method',
          'api.insomnia.rest',
          'my-api-service-0',
          '/path',
        ),
        ingressDocWithOverride(
          1,
          [keyAuthName('m1')],
          'put-method',
          'api.insomnia.rest',
          'my-api-service-0',
          '/path',
        ),
        ingressDocWithOverride(
          2,
          [keyAuthName('m2'), dummyName('m3')],
          'post-method',
          'api.insomnia.rest',
          'my-api-service-0',
          '/path',
        ),
      ]);
    });
  });
});
