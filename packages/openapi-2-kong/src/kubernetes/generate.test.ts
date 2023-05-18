import { describe, expect, it } from '@jest/globals';

import { dummyName, dummyPluginDoc, getSpec, pluginDummy } from '../declarative-config/jest/test-helpers';
import { xKongName } from '../types/kong';
import { K8sAnnotations, K8sIngressTLS } from '../types/kubernetes-config';
import { OA3Server } from '../types/openapi3';
import {
  generateIngressRule,
  generateKongForKubernetesConfigFromSpec,
  generateMetadataAnnotations,
  generateServiceName,
  generateServicePath,
  generateServicePort,
  generateTLS,
  getSpecName,
} from './generate';
import {
  ingressDoc,
  ingressDocWithOverride,
  keyAuthName,
  keyAuthPluginDoc,
  methodDoc,
  pluginKeyAuth,
} from './plugin-helpers';

describe('index', () => {
  describe('getSpecName()', () => {
    it('with info.title', () => {
      const spec = getSpec();
      expect(getSpecName(spec)).toBe('my-api');
    });

    it('no name', () => {
      const spec = getSpec({ info: undefined });
      expect(getSpecName(spec)).toBe('openapi');
    });

    it('with x-kong-name', () => {
      const spec = getSpec({ [xKongName]: 'kong-name' });
      expect(getSpecName(spec)).toBe('kong-name');
    });

    it('with x-kubernetes-ingress-metadata.name', () => {
      const spec = getSpec({
        [xKongName]: 'Kong Name',
        info: {
          'x-kubernetes-ingress-metadata': {
            name: 'K8s name',
          },
          title: '',
          version: '',
        },
      });
      expect(getSpecName(spec)).toBe('k8s-name');
    });
  });

  describe('generateMetadataAnnotations()', () => {
    it('gets annotations from x-kubernetes-ingress-metadata', () => {
      const spec = getSpec({
        info: {
          'x-kubernetes-ingress-metadata': {
            name: 'info-name',
            annotations: {
              'nginx.ingress.kubernetes.io/rewrite-target': '/',
            },
          },
          title: '',
          version: '',
        },
      });
      const result = generateMetadataAnnotations(spec, {
        pluginNames: [],
      });
      expect(result).toEqual({
        'kubernetes.io/ingress.class': 'kong',
        'nginx.ingress.kubernetes.io/rewrite-target': '/',
      });
    });

    it('gets only core annotation(s)', () => {
      const spec = getSpec();
      const result = generateMetadataAnnotations(spec, {
        pluginNames: [],
      });
      expect(result).toEqual({
        'kubernetes.io/ingress.class': 'kong',
      });
    });

    it('gets plugin annotations correctly', () => {
      const spec = getSpec();
      const result = generateMetadataAnnotations(spec, {
        pluginNames: ['one', 'two'],
      });
      expect(result).toEqual({
        'kubernetes.io/ingress.class': 'kong',
        'konghq.com/plugins': 'one, two',
      });
    });

    it('gets override annotation correctly', () => {
      const spec = getSpec();
      const result = generateMetadataAnnotations(spec, {
        pluginNames: [],
        overrideName: 'name',
      });
      expect(result).toEqual({
        'kubernetes.io/ingress.class': 'kong',
        'konghq.com/override': 'name',
      });
    });

    it('gets all annotations correctly', () => {
      const annotations: K8sAnnotations = {
        'nginx.ingress.kubernetes.io/rewrite-target': '/',
      };
      const spec = getSpec({
        info: {
          'x-kubernetes-ingress-metadata': {
            name: 'info-name',
            annotations,
          },
          title: '',
          version: '',
        },
      });
      const result = generateMetadataAnnotations(spec, {
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
      const sourceMetadata = spec.info['x-kubernetes-ingress-metadata']?.annotations;
      expect(sourceMetadata).toStrictEqual(annotations);
    });
  });

  describe('generateServiceName()', () => {
    it('defaults to ingress name', () => {
      const server: OA3Server = {
        url: 'https://insomnia.rest',
      };
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
      const server: OA3Server = {
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
      const server: OA3Server = {
        url: 'http://api.insomnia.rest',
      };
      expect(generateServicePort(server)).toEqual(80);
      server.url = 'https://api.insomnia.rest';
      expect(generateServicePort(server)).toEqual(80);
    });

    it('uses default 443 when tls configured ', () => {
      const server: OA3Server = {
        url: 'https://api.insomnia.rest',
        'x-kubernetes-tls': [
          {
            secretName: 'tls-secret',
          },
        ],
      };
      expect(generateServicePort(server)).toEqual(443);
    });

    it('uses 443 if any port is 443 when tls configured ', () => {
      const server: OA3Server = {
        url: 'https://api.insomnia.rest',
        'x-kubernetes-tls': [
          {
            secretName: 'tls-secret',
          },
        ],
        'x-kubernetes-service': {
          spec: {
            ports: [
              {
                port: 212,
              },
              {
                port: 443,
              },
            ],
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
            ports: [
              {
                port: 212,
              },
              {
                port: 322,
              },
            ],
          },
        },
      };
      expect(generateServicePort(server)).toEqual(123);
    });

    it('uses first port', () => {
      const server: OA3Server = {
        url: 'https://api.insomnia.rest',
        'x-kubernetes-service': {
          spec: {
            ports: [
              {
                port: 212,
              },
              {
                port: 322,
              },
            ],
          },
        },
      };
      expect(generateServicePort(server)).toEqual(212);
    });
  });

  describe('generateTLS', () => {
    const spec = getSpec();
    const server = spec.servers?.[0] as OA3Server;
    const ingressTLS: K8sIngressTLS[] = [{ secretName: 'ziltoid' }];

    it('should return null when no config is provided', () => {
      const tls = generateTLS(server);
      expect(tls).toEqual(null);
    });

    it('should return the tls config when provided', () => {
      const tls = generateTLS({
        ...server,
        'x-kubernetes-tls': ingressTLS,
      });
      expect(tls).toEqual(ingressTLS);
    });

    it('should throw when the tls config is not an array', () => {
      expect(() => generateTLS({
        ...server,
        // @ts-expect-error intentionally invalid
        'x-kubernetes-tls': ingressTLS[0],
      })).toThrow();
    });
  });

  describe('generateServicePath()', () => {
    it.each(['', '/'])('returns undefined if base path is [%o] and no specific path exists', serverBasePath => {
      expect(generateServicePath(serverBasePath)).toBe(undefined);
    });

    it.each(['/api/v1', '/api/v1/'])('adds closing wildcard if base path is [%o]', basePath => {
      expect(generateServicePath(basePath)).toBe('/api/v1/.*');
    });

    it('adds closing wildcard if basePath ends with wildcard and no specific path exists', () => {
      const serverBasePath = '/api/.*';
      expect(generateServicePath(serverBasePath)).toBe('/api/.*/.*');
    });

    it('adds /~ for kong 3.+ non legacy configs', () => {
      const serverBasePath = '/api/v1';
      expect(generateServicePath(serverBasePath, '', false)).toBe('/~/api/v1/.*');
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

  describe('generateIngressRule()', () => {
    it('handles basic server at root', () => {
      const result = generateIngressRule(
        0,
        {
          url: 'http://api.insomnia.rest',
        },
        'my-ingress',
      );
      expect(result).toStrictEqual({
        host: 'api.insomnia.rest',
        http: {
          paths: [
            {
              backend: {
                service: {
                  name: 'my-ingress-service-0',
                  port: {
                    number: 80,
                  },
                },
              },
              pathType: 'ImplementationSpecific',
            },
          ],
        },
      });
    });

    it('handles basic server with base path', () => {
      const result = generateIngressRule(
        0,
        {
          url: 'http://api.insomnia.rest/v1',
        },
        'my-ingress',
      );
      expect(result).toEqual({
        host: 'api.insomnia.rest',
        http: {
          paths: [
            {
              path: '/v1/.*',
              backend: {
                service: {
                  name: 'my-ingress-service-0',
                  port: {
                    number: 80,
                  },
                },
              },
              pathType: 'ImplementationSpecific',
            },
          ],
        },
      });
    });

    it('handles server with specific path', () => {
      const result = generateIngressRule(
        1,
        {
          url: 'http://api.insomnia.rest/v1',
        },
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
                service: {
                  name: 'my-ingress-service-1',
                  port: {
                    number: 80,
                  },
                },
              },
              pathType: 'ImplementationSpecific',
            },
          ],
        },
      });
    });

    it('handles server with no paths', () => {
      const result = generateIngressRule(
        1,
        {
          url: 'http://api.insomnia.rest/v1',
        },
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
                service: {
                  name: 'my-ingress-service-1',
                  port: {
                    number: 80,
                  },
                },
              },
              pathType: 'ImplementationSpecific',
            },
          ],
        },
      });
    });

    it('handles server url with protocol variable - no default', () => {
      const server = {
        url: '{protocol}://api.insomnia.rest/v1',
      };
      const result = generateIngressRule(1, server, 'my-ingress', []);
      expect(result).toEqual({
        host: 'api.insomnia.rest',
        http: {
          paths: [
            {
              path: '/v1/.*',
              backend: {
                service: {
                  name: 'my-ingress-service-1',
                  port : {
                    number: 80,
                  },
                },
              },
              pathType: 'ImplementationSpecific',
            },
          ],
        },
      });
      expect(server.url).toBe('http://api.insomnia.rest/v1');
    });

    it('handles server url with protocol variable - with default', () => {
      const server = {
        url: '{protocol}://api.insomnia.rest/v1',
        variables: {
          protocol: {
            default: 'https',
          },
        },
      };
      const result = generateIngressRule(1, server, 'my-ingress', []);
      expect(result).toEqual({
        host: 'api.insomnia.rest',
        http: {
          paths: [
            {
              path: '/v1/.*',
              backend: {
                service: {
                  name: 'my-ingress-service-1',
                  port: {
                    number: 80,
                  },
                },
              },
              pathType: 'ImplementationSpecific',
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
      const result = generateIngressRule(1, server, 'my-ingress', []);
      expect(result).toEqual({
        host: 'api.insomnia.rest',
        http: {
          paths: [
            {
              path: '/.*/v1/.*',
              backend: {
                service: {
                  name: 'my-ingress-service-1',
                  port: {
                    number: 80,
                  },
                },
              },
              pathType: 'ImplementationSpecific',
            },
          ],
        },
      });
      expect(server.url).toBe('http://api.insomnia.rest/.*/v1');
    });
  });

  describe('generateKongForKubernetesConfigFromSpec()', () => {
    const servers = [
      {
        url: 'http://api.insomnia.rest',
      },
    ];

    it('handles global plugins', () => {
      const spec = getSpec({ servers, ...pluginKeyAuth, ...pluginDummy });
      const result = generateKongForKubernetesConfigFromSpec(spec);
      expect(result.documents).toStrictEqual([
        keyAuthPluginDoc('g0'),
        dummyPluginDoc('g1'),
        ingressDoc(0, [keyAuthName('g0'), dummyName('g1')], 'api.insomnia.rest', 'my-api-service-0'),
      ]);
    });

    it('handles global and server plugins', () => {
      const spec = getSpec({
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
      const result = generateKongForKubernetesConfigFromSpec(spec);
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

    it('handles global and path plugins', () => {
      const spec = getSpec({
        servers,
        ...pluginKeyAuth,
        paths: {
          '/no-plugin': {},
          '/plugin-0': { ...pluginKeyAuth },
          '/plugin-1': { ...pluginKeyAuth, ...pluginDummy },
        },
      });
      const result = generateKongForKubernetesConfigFromSpec(spec);
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

    it('handles global and method plugins', () => {
      const spec = getSpec({
        servers,
        ...pluginKeyAuth,
        paths: {
          '/path': {
            get: {},
            put: { ...pluginKeyAuth },
            post: { ...pluginKeyAuth, ...pluginDummy },
          },
        },
      });
      const result = generateKongForKubernetesConfigFromSpec(spec);
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
