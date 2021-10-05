import { DCPlugin, K8sKongPlugin, K8sKongPluginBase, OpenApi3Spec } from '../../types';
import { PluginBase, XKongPlugin } from '../../types/kong';

export const tags = ['Tag'];

/** used only for testing */
export interface DummyPlugin extends PluginBase<'dummy'> {
  config: {
    foo: 'bar';
  };
}
export type XKongPluginDummy = XKongPlugin<DummyPlugin>;
export const pluginDummy: XKongPluginDummy = {
  'x-kong-plugin-dummy': {
    name: 'dummy',
    config: {
      foo: 'bar',
    },
  },
};

export const dummyName = (suffix: string) => `add-dummy-${suffix}`;

export const dummyPluginDoc = (suffix: string): K8sKongPluginBase<DummyPlugin> => ({
  apiVersion: 'configuration.konghq.com/v1',
  config: {
    foo: 'bar',
  },
  kind: 'KongPlugin',
  metadata: {
    name: dummyName(suffix),
  },
  plugin: 'dummy',
});

/**
 * This simulates what a user would do when creating a custom plugin.
 *
 * In the user's case they would, in practice, use module augmentation to extend DCPlugin, however a simple union achieves the same goal, here.
 */
export type UserDCPlugin = DCPlugin | DummyPlugin;

/**
 * This simulates what a user would do when creating a custom plugin.
 *
 * In the user's case they would, in practice, use module augmentation to extend K8sKongPlugin, however a simple union achieves the same goal, here.
 */
export type UserK8sPlugin = K8sKongPlugin | K8sKongPluginBase<DummyPlugin>;

/**
 * This simulates what a user would do when creating a custom plugin.
 *
 * In the user's case they would, in practice, use module augmentation to extend K8sKongPlugin, however a simple union achieves the same goal, here.
 */
export type UserXKongPlugin = XKongPlugin<Plugin> | XKongPlugin<DummyPlugin>;

/** This function is written in such a way as to allow mutations in tests but without affecting other tests. */
export const getSpec = (overrides: Partial<OpenApi3Spec> = {}): OpenApi3Spec =>
  JSON.parse(
    JSON.stringify({
      openapi: '3.0',
      info: {
        version: '1.0',
        title: 'My API',
      },
      servers: [
        {
          url: 'https://server1.com/path',
        },
      ],
      paths: {
        '/cats': {
          'x-kong-name': 'Cat stuff',
          summary: 'summary is ignored',
          post: {},
        },
        '/dogs': {
          summary: 'Dog stuff',
          get: {},
          post: {
            summary: 'Ignored summary',
          },
        },
        '/birds/{id}': {
          get: {},
        },
      },
      ...overrides,
    }),
  );
