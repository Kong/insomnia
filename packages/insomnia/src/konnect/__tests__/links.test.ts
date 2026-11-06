import { afterEach, describe, expect, it, vi } from 'vitest';

import { getKongDocsOrigin, getKonnectCloudOrigin } from '../../common/constants';
import { getKonnectPluginCreateUrl, getKonnectPluginEditUrl, getKonnectPluginsUrl, getPluginDocsUrl } from '../links';

describe('Konnect plugin links', () => {
  it('builds the control plane plugins URL', () => {
    expect(getKonnectPluginsUrl('us', 'cp-1')).toBe(`${getKonnectCloudOrigin()}/us/gateway-manager/cp-1/plugins`);
  });

  it('builds the plugin create URL', () => {
    expect(getKonnectPluginCreateUrl('eu', 'cp-1', 'key-auth')).toBe(
      `${getKonnectCloudOrigin()}/eu/gateway-manager/cp-1/plugins/key-auth/create`,
    );
  });

  it('builds the plugin edit URL', () => {
    expect(getKonnectPluginEditUrl('us', 'cp-1', 'key-auth', 'plugin-1')).toBe(
      `${getKonnectCloudOrigin()}/us/gateway-manager/cp-1/plugins/key-auth/plugin-1/update`,
    );
  });

  it('encodes URL path segments', () => {
    expect(getKonnectPluginEditUrl('us', 'cp 1', 'key auth', 'plugin/1')).toBe(
      `${getKonnectCloudOrigin()}/us/gateway-manager/cp%201/plugins/key%20auth/plugin%2F1/update`,
    );
  });

  it.each([
    ['missing region', undefined, 'cp-1'],
    ['missing control plane', 'us', undefined],
  ])('returns null when %s', (_label, region, controlPlaneId) => {
    expect(getKonnectPluginsUrl(region, controlPlaneId)).toBeNull();
    expect(getKonnectPluginCreateUrl(region, controlPlaneId, 'key-auth')).toBeNull();
    expect(getKonnectPluginEditUrl(region, controlPlaneId, 'key-auth', 'plugin-1')).toBeNull();
  });

  it('builds the plugin docs URL', () => {
    expect(getPluginDocsUrl('key-auth')).toBe(`${getKongDocsOrigin()}/plugins/key-auth/`);
  });

  it('reads the Konnect and docs origins from configuration', () => {
    vi.stubEnv('KONNECT_CLOUD_ORIGIN', 'https://cloud.example.com/');
    vi.stubEnv('KONG_DOCS_ORIGIN', 'https://docs.example.com/');

    expect(getKonnectPluginsUrl('us', 'cp-1')).toBe('https://cloud.example.com/us/gateway-manager/cp-1/plugins');
    expect(getPluginDocsUrl('key-auth')).toBe('https://docs.example.com/plugins/key-auth/');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });
});
