import { describe, expect, it } from 'vitest';

import { ProxyConfig, ProxyConfigList, transformToSdkProxyOptions } from '../proxy-configs';
import { Url } from '../urls';

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
      protocol: 'https:',
    });

    expect(proxyConfig.getProtocols()).toEqual(['http', 'https']);

    expect(proxyConfig.getProxyUrl()).toEqual('https://proxy_username:proxy_password@proxy.com:8080');

    expect(proxyConfig.test('http://a.example.com:80/a')).toBeTruthy();

    const configList = new ProxyConfigList<ProxyConfig>(undefined, []);
    configList.add(proxyConfig);
    configList.add(
      new ProxyConfig({
        match: 'https://*.example.com:80/*',
        host: 'proxy.com',
        port: 8080,
        tunnel: true,
        disabled: false,
        authenticate: true,
        username: 'proxy_username',
        password: 'proxy_password',
        protocol: 'https:',
      }),
    );

    const matchedProxyConfigDef = configList.resolve(new Url('http://sub.example.com:80/path'));
    expect(matchedProxyConfigDef?.host).toEqual('proxy.com');
  });

  const proxyUrls = [
    'http://wormhole',
    'http://wormhole:0',
    'https://localhost',
    'http://user:pass@localhost:666',
    'http://user:pass@localhost:0',
    'http://user:pass@localhost',
  ];

  proxyUrls.forEach(url => {
    it(`test proxy transforming: ${url}`, () => {
      const proxy = new ProxyConfig(transformToSdkProxyOptions('http:', url, '', true, ''));
      expect(proxy.getProxyUrl()).toEqual(url);
    });
  });

  it('does not parse a malformed proxy host when the proxy is disabled', () => {
    expect(() => transformToSdkProxyOptions('', 'fasdf', '', false, '')).not.toThrow();
    const options = transformToSdkProxyOptions('', 'fasdf', '', false, '');
    expect(options.disabled).toBe(true);
    expect(options.host).toEqual('');
  });

  it('throws on a malformed proxy host when the proxy is enabled', () => {
    expect(() => transformToSdkProxyOptions('', 'fasdf', '', true, '')).toThrow(/Failed to parse proxy/);
  });

  it('toObject returns {} when there are no proxy configs', () => {
    expect(new ProxyConfigList<ProxyConfig>(undefined, []).toObject()).toEqual({});
  });

  it('toObject returns a map keyed by match pattern when there are proxy configs', () => {
    const proxyConfig1 = new ProxyConfig({
      match: 'http+https://*.example.com:80/*',
      host: 'proxy.com',
      port: 8080,
      tunnel: true,
      disabled: false,
      authenticate: true,
      username: 'proxy_username',
      password: 'proxy_password',
      protocol: 'https:',
    });
    const proxyConfig2 = new ProxyConfig({
      match: 'https://*.example2.com:80/*',
      host: 'proxy2.com',
      port: 8081,
      tunnel: false,
      disabled: false,
      authenticate: false,
      username: '',
      password: '',
      protocol: 'https:',
    });

    const configList = new ProxyConfigList<ProxyConfig>(undefined, [proxyConfig1, proxyConfig2]);

    expect(configList.toObject()).toEqual({
      [proxyConfig1.match]: proxyConfig1.toJSON(),
      [proxyConfig2.match]: proxyConfig2.toJSON(),
    });
  });
});
