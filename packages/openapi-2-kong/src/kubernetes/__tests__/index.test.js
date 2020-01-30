// @flow
import { parseSpec } from '../../index';
import {
  generateMetadataAnnotations,
  generateMetadataName,
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
});
