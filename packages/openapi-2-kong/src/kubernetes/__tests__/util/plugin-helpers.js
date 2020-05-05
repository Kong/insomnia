// @flow

export const pluginKeyAuth = {
  'x-kong-plugin-key-auth': {
    name: 'key-auth',
    config: {
      key_names: ['api_key', 'apikey'],
      key_in_body: false,
      hide_credentials: true,
    },
  },
};
export const pluginDummy = {
  'x-kong-plugin-dummy-thing': {
    name: 'dummy-thing',
    config: { foo: 'bar' },
  },
};

export const keyAuthPluginDoc = (suffix: string) => ({
  apiVersion: 'configuration.konghq.com/v1',
  config: {
    hide_credentials: true,
    key_in_body: false,
    key_names: ['api_key', 'apikey'],
  },
  kind: 'KongPlugin',
  metadata: {
    name: keyAuthName(suffix),
  },
  plugin: 'key-auth',
});
export const dummyPluginDoc = (suffix: string) => ({
  apiVersion: 'configuration.konghq.com/v1',
  config: { foo: 'bar' },
  kind: 'KongPlugin',
  metadata: {
    name: dummyName(suffix),
  },
  plugin: 'dummy-thing',
});
export const methodDoc = (method: string) => ({
  apiVersion: 'configuration.konghq.com/v1',
  kind: 'KongIngress',
  metadata: {
    name: `${method}-method`,
  },
  route: {
    methods: [method.toUpperCase()],
  },
});

export const keyAuthName = (suffix: string) => `add-key-auth-${suffix}`;
export const dummyName = (suffix: string) => `add-dummy-thing-${suffix}`;

export const ingressDoc = (
  plugins: Array<string>,
  host: string,
  serviceName: string,
  path: ?string,
) => ({
  apiVersion: 'extensions/v1beta1',
  kind: 'Ingress',
  metadata: {
    annotations: {
      'konghq.com/plugins': plugins.join(', '),
    },
    name: 'my-api',
  },
  spec: {
    rules: [
      {
        host,
        http: {
          paths: [{ backend: { serviceName, servicePort: 80 }, path }],
        },
      },
    ],
  },
});

export const ingressDocWithOverride = (
  plugins: Array<string>,
  override: string,
  host: string,
  serviceName: string,
  path: ?string,
) => ({
  apiVersion: 'extensions/v1beta1',
  kind: 'Ingress',
  metadata: {
    annotations: {
      'konghq.com/plugins': plugins.join(', '),
      'konghq.com/override': override,
    },
    name: 'my-api',
  },
  spec: {
    rules: [
      {
        host,
        http: {
          paths: [{ backend: { serviceName, servicePort: 80 }, path }],
        },
      },
    ],
  },
});
