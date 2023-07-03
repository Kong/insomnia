import { describe, expect, it } from '@jest/globals';

import { KeyAuthPlugin, xKongPluginKeyAuth } from '../types/kong';
import { getSpec, tags } from './jest/test-helpers';
import { generatePlugins } from './plugins';
import { generateServices } from './services';
import { generateUpstreams } from './upstreams';

describe('tags', () => {
  it('test that tags are appended to Service entities', async () => {
    const spec = getSpec();
    const services = generateServices(spec, tags);
    services.forEach(service => {
      expect(service.tags).toEqual(tags);
    });
  });

  it('test that tags are appended to Route entities', async () => {
    const spec = getSpec();
    const services = generateServices(spec, tags);
    services.forEach(service => {
      service.routes.forEach(route => {
        expect(route.tags).toEqual(tags);
      });
    });
  });

  it('test that tags are appended to Plugin entities', () => {
    const pluginTags = ['pluginTag'];
    const spec = getSpec();
    const keyAuthPlugin: KeyAuthPlugin = {
      name: 'key-auth',
      config: {
        key_names: ['x-api-key'],
      },
      tags: pluginTags,
    };
    spec[xKongPluginKeyAuth] = keyAuthPlugin;
    const plugins = generatePlugins(spec, tags);
    const resultingTags = [...tags, ...pluginTags];
    plugins.forEach(plugin => {
      expect(plugin.tags).toEqual(resultingTags);
    });
  });

  it('test that tags are appended to Upstream entities', () => {
    const spec = getSpec();
    const upstreams = generateUpstreams(spec, tags);
    upstreams.forEach(upstream => {
      expect(upstream.tags).toEqual(tags);
    });
  });

  it('test that tags are appended to Target entities', () => {
    const spec = getSpec();
    const upstreams = generateUpstreams(spec, tags);
    upstreams.forEach(upstream => {
      upstream.targets.forEach(target => {
        expect(target.tags).toEqual(tags);
      });
    });
  });
});
