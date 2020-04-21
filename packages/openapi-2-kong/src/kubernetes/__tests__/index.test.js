// @flow
import { parseSpec } from '../../index';
import {
  generateKongForKubernetesConfigFromSpec,
  generateMetadataAnnotations,
  generateMetadataName,
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

  describe('generateMetadataName()', () => {
    it('with info.title', async () => {
      const api: OpenApi3Spec = await parseSpec({ ...spec });
      expect(generateMetadataName(api)).toBe('my-api');
    });

    it('no name', async () => {
      const api: OpenApi3Spec = await parseSpec({ ...spec, info: undefined });
      expect(generateMetadataName(api)).toBe('openapi');
    });

    it('with x-kong-name', () => {
      const api: OpenApi3Spec = { ...spec, 'x-kong-name': 'kong-name' };

      expect(generateMetadataName(api)).toBe('kong-name');
    });

    it('with x-kubernetes-ingress-metadata.name', async () => {
      const api: OpenApi3Spec = await parseSpec({
        ...spec,
        'x-kong-name': 'Kong Name',
        info: {
          'x-kubernetes-ingress-metadata': {
            name: 'k8s-name',
          },
        },
      });
      expect(generateMetadataName(api)).toBe('k8s-name');
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
        'nginx.ingress.kubernetes.io/rewrite-target': '/',
      });
    });

    it('gets no annotations', () => {
      const result = generateMetadataAnnotations(spec, { pluginNames: [] });
      expect(result).toBe(null);
    });

    it('gets plugin annotations correctly', () => {
      const result = generateMetadataAnnotations(spec, { pluginNames: ['one', 'two'] });
      expect(result).toEqual({ 'konghq.com/plugins': 'one, two' });
    });

    it('gets override annotation correctly', () => {
      const result = generateMetadataAnnotations(spec, { pluginNames: [], overrideName: 'name' });
      expect(result).toEqual({ 'konghq.com/override': 'name' });
    });

    it('gets all annotations correctly', async () => {
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
      const result = generateMetadataAnnotations(api, {
        pluginNames: ['one', 'two'],
        overrideName: 'name',
      });
      expect(result).toEqual({
        'nginx.ingress.kubernetes.io/rewrite-target': '/',
        'konghq.com/plugins': 'one, two',
        'konghq.com/override': 'name',
      });
    });
  });

  describe('generateServiceName()', () => {
    it('defaults to ingress name', () => {
      const server: OA3Server = { url: 'https://insomnia.rest' };
      expect(generateServiceName(server, 'ingrs', 0)).toBe('ingrs-s0');
      expect(generateServiceName(server, 'ingrs', 3)).toBe('ingrs-s3');
    });

    it('uses x-kubernetes-backend.serviceName', () => {
      const server: OA3Server = {
        url: 'https://insomnia.rest',
        'x-kubernetes-backend': {
          serviceName: 'b-name',
          servicePort: 123,
        },
      };
      expect(generateServiceName(server, 'ingrs', 0)).toBe('b-name');
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
      expect(generateServiceName(server, 'ingrs', 0)).toBe('s-name');
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
    it('uses no path in the server', () => {
      const server = { url: 'https://api.insomnia.rest' };
      const backend = { serviceName: 'svc', servicePort: 80 };
      expect(generateServicePath(server, backend)).toEqual({ backend });
    });

    it('uses path in the server', () => {
      const server = { url: 'https://api.insomnia.rest/api/v1' };
      const backend = { serviceName: 'svc', servicePort: 80 };
      expect(generateServicePath(server, backend)).toEqual({
        path: '/api/v1/.*',
        backend,
      });
    });

    it('uses path in the server and adds closing wildcard if url ends with /', () => {
      const server = { url: 'https://api.insomnia.rest/api/v1/' };
      const backend = { serviceName: 'svc', servicePort: 80 };
      expect(generateServicePath(server, backend)).toEqual({
        path: '/api/v1/.*',
        backend,
      });
    });

    it('converts path variables to .* wildcards', () => {
      const server = { url: 'https://api.insomnia.rest/api/v1' };
      const backend = { serviceName: 'svc', servicePort: 80 };
      expect(generateServicePath(server, backend, '/specificPath')).toEqual({
        path: '/api/v1/specificPath',
        backend,
      });
    });

    it('using a specific path with variables does not add closing wildcard', () => {
      const server = { url: 'https://api.insomnia.rest/api/v1' };
      const backend = { serviceName: 'svc', servicePort: 80 };
      expect(generateServicePath(server, backend, '/{version}/{test}/specificPath')).toEqual({
        path: '/api/v1/.*/.*/specificPath',
        backend,
      });
    });
  });

  describe('generateRulesForServer()', () => {
    it('handles basic server', () => {
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
                serviceName: 'my-ingress-s0',
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
                serviceName: 'my-ingress-s1',
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
                serviceName: 'my-ingress-s1',
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
                serviceName: 'my-ingress-s0',
                servicePort: 443,
              },
            },
          ],
          secretName: 'my-secret',
        },
      });
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

      expect(result.documents).toEqual([
        keyAuthPluginDoc('g0'),
        dummyPluginDoc('g1'),
        ingressDoc([keyAuthName('g0'), dummyName('g1')], 'api.insomnia.rest', 'my-api-s0'),
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

      expect(result.documents).toEqual([
        keyAuthPluginDoc('g0'),
        keyAuthPluginDoc('s1'),
        keyAuthPluginDoc('s2'),
        dummyPluginDoc('s3'),
        ingressDoc([keyAuthName('g0')], 'api-0.insomnia.rest', 'my-api-s0'),
        ingressDoc([keyAuthName('g0'), keyAuthName('s1')], 'api-1.insomnia.rest', 'my-api-s1'),
        ingressDoc(
          [keyAuthName('g0'), keyAuthName('s2'), dummyName('s3')],
          'api-2.insomnia.rest',
          'my-api-s2',
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

      expect(result.documents).toEqual([
        keyAuthPluginDoc('g0'),
        keyAuthPluginDoc('p1'),
        keyAuthPluginDoc('p2'),
        dummyPluginDoc('p3'),
        ingressDoc([keyAuthName('g0')], 'api.insomnia.rest', 'my-api-s0', '/no-plugin'),
        ingressDoc(
          [keyAuthName('g0'), keyAuthName('p1')],
          'api.insomnia.rest',
          'my-api-s0',
          '/plugin-0',
        ),
        ingressDoc(
          [keyAuthName('g0'), keyAuthName('p2'), dummyName('p3')],
          'api.insomnia.rest',
          'my-api-s0',
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

      expect(result.documents).toEqual([
        methodDoc('get'),
        methodDoc('put'),
        methodDoc('post'),
        keyAuthPluginDoc('g0'),
        keyAuthPluginDoc('m1'),
        keyAuthPluginDoc('m2'),
        dummyPluginDoc('m3'),
        ingressDocWithOverride(
          [keyAuthName('g0')],
          'get-method',
          'api.insomnia.rest',
          'my-api-s0',
          '/path',
        ),
        ingressDocWithOverride(
          [keyAuthName('g0'), keyAuthName('m1')],
          'put-method',
          'api.insomnia.rest',
          'my-api-s0',
          '/path',
        ),
        ingressDocWithOverride(
          [keyAuthName('g0'), keyAuthName('m2'), dummyName('m3')],
          'post-method',
          'api.insomnia.rest',
          'my-api-s0',
          '/path',
        ),
      ]);
    });
  });
});
