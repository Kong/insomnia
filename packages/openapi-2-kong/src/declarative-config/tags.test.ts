import { KeyAuthPlugin, xKongPluginKeyAuth } from '../types/kong';
import { generatePlugins } from './plugins';
import { generateServices } from './services';
import { tags, getSpec } from './jest/test-helpers';
import { generateUpstreams } from './upstreams';

describe('tags', () => {
  it('test that tags are appended to Service entities', () => {
    const spec = getSpec();
    const services = generateServices(spec, tags);
    services.forEach(service => {
      expect(service.tags).toEqual(tags);
    });
  });

  it('test that tags are appended to Route entities', () => {
    const spec = getSpec();
    const services = generateServices(spec, tags);
    services.forEach(service => {
      service.routes.forEach(route => {
        expect(route.tags).toEqual(tags);
      });
    });
  });

  it('test that tags are appended to Plugin entities', () => {
    const spec = getSpec();
    const keyAuthPlugin: KeyAuthPlugin = {
      name: 'key-auth',
      config: {
        key_names: ['x-api-key'],
      },
    };
    spec[xKongPluginKeyAuth] = keyAuthPlugin;
    const plugins = generatePlugins(spec, tags);
    plugins.forEach(plugin => {
      expect(plugin.tags).toEqual(tags);
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
