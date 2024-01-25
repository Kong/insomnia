import { describe, expect, it } from '@jest/globals';

import { ProxyConfig } from '../proxy-configs';

describe('test ProxyConfig object', () => {
  it('test basic operations', () => {

    const proxyConfig = new ProxyConfig({
      match: 'http+https://*.example.com:80/*',
      host: 'proxy.com',
      port: 8080,
      tunnel: true,
      disabled: false,
      authenticate: true,
      username: 'proxy_username',
      password: 'proxy_password',
    });

    expect(
      proxyConfig.getProtocols()
    ).toEqual(
      ['http', 'https']
    );

    proxyConfig.updateProtocols(['http']);
    expect(
      proxyConfig.getProtocols()
    ).toEqual(
      ['http']
    );

    expect(proxyConfig.getProxyUrl()).toEqual(
      'http://proxy_username:proxy_password@proxy.com:8080'
    );

    expect(
      proxyConfig.test('http://a.example.com:80/a')
    ).toBeTruthy();
  });
});
