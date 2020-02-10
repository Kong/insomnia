// @flow
import { parseSpec } from '../../index';
import {
  generateKongForKubernetesConfigFromSpec,
  generateMetadataAnnotations,
  generateMetadataName, generatePluginDocuments,
  generateRules,
  generateServiceName,
  generateServicePath,
  generateServicePort,
} from '../index';

describe('index', () => {
  const spec = {
    openapi: '3.0',
    info: { version: '1.0', title: 'My API' },
    servers: [{
      url: 'http://api.insomnia.rest',
    }],
    paths: [],
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

    it('with x-kong-name', async () => {
      const api: OpenApi3Spec = await parseSpec({ ...spec, 'x-kong-name': 'Kong Name' });
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
    it('gets annotations', async () => {
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
      expect(generateMetadataAnnotations(api)).toEqual({
        'nginx.ingress.kubernetes.io/rewrite-target': '/',
      });
    });

    it('gets no annotations', async () => {
      const api: OpenApi3Spec = await parseSpec({ ...spec });
      expect(generateMetadataAnnotations(api)).toBe(null);
    });
  });

  describe('generateServiceName()', () => {
    it('defaults to ingress name', () => {
      const server = { url: 'https://insomnia.rest' };
      expect(generateServiceName(server, 'ingrs', 0)).toBe('ingrs-s0');
      expect(generateServiceName(server, 'ingrs', 3)).toBe('ingrs-s3');
    });

    it('uses x-kubernetes-backend.name', () => {
      const server = {
        url: 'https://insomnia.rest',
        'x-kubernetes-backend': {
          serviceName: 'b-name',
        },
      };
      expect(generateServiceName((server: Object), 'ingrs', 0)).toBe('b-name');
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
      expect(generateServiceName((server: Object), 'ingrs', 0)).toBe('s-name');
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
      expect(generateServicePort((server: Object))).toEqual(443);
    });

    it('uses uses first port', () => {
      const server = {
        url: 'https://api.insomnia.rest',
        'x-kubernetes-service': {
          spec: {
            ports: [
              { port: 212 },
              { port: 322 },
            ],
          },
        },
      };
      expect(generateServicePort((server: Object))).toEqual(212);
    });
  });

  describe('generateServicePath()', () => {
    it('uses no path', () => {
      const server = { url: 'https://api.insomnia.rest' };
      const backend = { serviceName: 'svc', servicePort: 80 };
      expect(generateServicePath(server, backend)).toEqual({
        backend: {
          serviceName: backend.serviceName,
          servicePort: backend.servicePort,
        },
      });
    });

    it('uses path', () => {
      const server = { url: 'https://api.insomnia.rest/api/v1' };
      const backend = { serviceName: 'svc', servicePort: 80 };
      expect(generateServicePath(server, backend)).toEqual({
        path: '/api/v1/.*',
        backend: {
          serviceName: backend.serviceName,
          servicePort: backend.servicePort,
        },
      });
    });
  });

  describe('generateRules()', () => {
    it('handles basic server', async () => {
      const api: OpenApi3Spec = await parseSpec({ ...spec });
      expect(generateRules(api, 'my-ingress')).toEqual([
        {
          host: 'api.insomnia.rest',
          http: {
            paths: [{
              backend: {
                serviceName: 'my-ingress-s0',
                servicePort: 80,
              },
            }],
          },
        },
      ]);
    });

    it('handles multiple servers', async () => {
      const api: OpenApi3Spec = await parseSpec({
        ...spec,
        servers: [...spec.servers, { url: 'http://updates.insomnia.rest/v1' }],
      });

      expect(generateRules(api, 'my-ingress')).toEqual([{
        host: 'api.insomnia.rest',
        http: {
          paths: [{
            backend: {
              serviceName: 'my-ingress-s0',
              servicePort: 80,
            },
          }],
        },
      }, {
        host: 'updates.insomnia.rest',
        http: {
          paths: [{
            path: '/v1/.*',
            backend: {
              serviceName: 'my-ingress-s1',
              servicePort: 80,
            },
          }],
        },
      }]);
    });

    it('handles TLS', async () => {
      const api: OpenApi3Spec = await parseSpec({
        ...spec,
        servers: [{
          url: 'http://api.insomnia.rest/v1',
          'x-kubernetes-tls': {
            secretName: 'my-secret',
          },
        }],
      });

      expect(generateRules(api, 'my-ingress')).toEqual([{
        host: 'api.insomnia.rest',
        tls: {
          paths: [{
            path: '/v1/.*',
            backend: {
              serviceName: 'my-ingress-s0',
              servicePort: 443,
            },
          }],
          secretName: 'my-secret',
        },
      }]);
    });

    it('handles TLS and HTTP', async () => {
      const api: OpenApi3Spec = await parseSpec({
        ...spec,
        servers: [{
          url: 'http://api.insomnia.rest/v1',
          'x-kubernetes-tls': {
            secretName: 'my-secret',
          },
        }, {
          url: 'http://api2.insomnia.rest/v1',
          http: { paths: [] },
        }],
      });

      expect(generateRules(api, 'my-ingress')).toEqual([{
        host: 'api.insomnia.rest',
        tls: {
          paths: [{
            path: '/v1/.*',
            backend: {
              serviceName: 'my-ingress-s0',
              servicePort: 443,
            },
          }],
          secretName: 'my-secret',
        },
      }, {
        host: 'api2.insomnia.rest',
        http: {
          paths: [{
            path: '/v1/.*',
            backend: {
              serviceName: 'my-ingress-s1',
              servicePort: 80,
            },
          }],
        },
      }]);
    });

    it('creates rule with path', async () => {
      const api: OpenApi3Spec = await parseSpec({
        ...spec,
        servers: [{
          url: 'http://api.insomnia.rest/v1',
          http: { paths: [] },
        }],
      });

      expect(generateRules(api, 'my-ingress')).toEqual([{
        host: 'api.insomnia.rest',
        http: {
          paths: [{
            path: '/v1/.*',
            backend: {
              serviceName: 'my-ingress-s0',
              servicePort: 80,
            },
          }],
        },
      }]);
    });
  });

  describe('generateSecurityPlugin()', () => {
    it('generates apikey plugin', async () => {
      const api: OpenApi3Spec = await parseSpec({
        ...spec,
        'x-kong-plugin-key-auth': {
          config: {
            key_names: ['api_key', 'apikey'],
            key_in_body: false,
            hide_credentials: true,
          },
        },
        'x-kong-plugin-with-name': {
          name: 'my-name',
        },
      });

      const result = generatePluginDocuments(api);
      expect(result).toEqual([{
        apiVersion: 'configuration.konghq.com/v1',
        config: {
          hide_credentials: true,
          key_in_body: false,
          key_names: [
            'api_key',
            'apikey',
          ],
        },
        kind: 'KongPlugin',
        metadata: {
          name: 'add-key-auth',
        },
        plugin: 'key-auth',
      }, {
        apiVersion: 'configuration.konghq.com/v1',
        kind: 'KongPlugin',
        metadata: {
          name: 'add-my-name',
        },
        plugin: 'my-name',
      }]);
    });

    it('generates apikey plugin', async () => {
      const api: OpenApi3Spec = await parseSpec({
        ...spec,
        'x-kong-plugin-key-auth': {
          name: 'key-auth',
          config: {
            key_names: ['api_key', 'apikey'],
            key_in_body: false,
            hide_credentials: true,
          },
        },
      });

      const result = generatePluginDocuments(api);
      expect(result).toEqual([{
        apiVersion: 'configuration.konghq.com/v1',
        config: {
          hide_credentials: true,
          key_in_body: false,
          key_names: [
            'api_key',
            'apikey',
          ],
        },
        kind: 'KongPlugin',
        metadata: {
          name: 'add-key-auth',
        },
        plugin: 'key-auth',
      }]);
    });

    it('generates security plugin', async () => {
      const api: OpenApi3Spec = await parseSpec({
        ...spec,
        security: [
          {
            really_basic: [],
            your_api_key: [],
          },
        ],
        'x-kong-plugin-dummy-thing': {
          name: 'dummy-thing',
          config: { foo: 'bar' },
        },
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
      });

      const result = generateKongForKubernetesConfigFromSpec(api, []);
      expect(result.documents).toEqual([{
        apiVersion: 'configuration.konghq.com/v1',
        kind: 'KongPlugin',
        plugin: 'dummy-thing',
        metadata: { name: 'add-dummy-thing' },
        config: { foo: 'bar' },
      }, {
        apiVersion: 'configuration.konghq.com/v1',
        kind: 'KongPlugin',
        plugin: 'basic-auth',
        metadata: { name: 'add-basic-auth' },
      }, {
        apiVersion: 'configuration.konghq.com/v1',
        kind: 'KongPlugin',
        plugin: 'key-auth',
        metadata: { name: 'add-key-auth' },
        config: { key_names: ['api_key_by_you'] },
      }, {
        apiVersion: 'extensions/v1beta1',
        kind: 'Ingress',
        metadata: {
          annotations: {
            'plugins.konghq.com': 'add-dummy-thing, add-basic-auth, add-key-auth',
          },
          name: 'my-api',
        },
        spec: {
          rules: [{
            host: 'api.insomnia.rest',
            http: {
              paths: [{ backend: { serviceName: 'my-api-s0', servicePort: 80 } }],
            },
          }],
        },
      }]);
    });
  });
});
