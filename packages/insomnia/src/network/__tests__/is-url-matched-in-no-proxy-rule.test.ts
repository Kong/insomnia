import { beforeEach, describe, expect, it } from '@jest/globals';

import { globalBeforeEach } from '../../__jest__/before-each';
import { isUrlMatchedInNoProxyRule } from '../is-url-matched-in-no-proxy-rule';

describe('isUrlMatchedInNoProxyRule - noProxyRule hostname and wildcard matches', () => {
  beforeEach(globalBeforeEach);

  it('should handle poorly formatted url', () => {
    const noProxyRule = 'localhost,127.0.0.1';
    const url = '';
    expect(isUrlMatchedInNoProxyRule(url, noProxyRule)).toBe(false);
  });

  it('should handle invalid url', () => {
    const noProxyRule = 'localhost,127.0.0.1';
    const url = 'this is not a valid url and can not be parsed by the node url.parse library';
    expect(isUrlMatchedInNoProxyRule(url, noProxyRule)).toBe(false);
  });

  it('should handle poorly formatted noProxyRule', () => {
    const noProxyRule = null;
    const url = 'https://git.acme.com/username/repo-name';
    expect(isUrlMatchedInNoProxyRule(url, noProxyRule)).toBe(false);
  });

  it('should handle basic filtering', () => {
    const noProxyRule = 'localhost,git.acme.com,127.0.0.1,,,';
    const url = 'https://127.0.0.1/username/repo-name';
    expect(isUrlMatchedInNoProxyRule(url, noProxyRule)).toBe(true);
  });

  it('should handle basic filtering with trailing dot', () => {
    const noProxyRule = 'localhost.,git.acme.com,127.0.0.1';
    const url = 'https://localhost/username/repo-name';
    expect(isUrlMatchedInNoProxyRule(url, noProxyRule)).toBe(true);
  });

  it('should match an exact domain', () => {
    const noProxyRule = 'localhost,git.acme.com,127.0.0.1';
    const url = 'https://git.acme.com/username/repo-name';
    expect(isUrlMatchedInNoProxyRule(url, noProxyRule)).toBe(true);
  });

  it('should match to a FQDN domain', () => {
    const noProxyRule = 'localhost,git.acme.com,127.0.0.1';
    const url = 'https://hostname.git.acme.com/username/repo-name';
    expect(isUrlMatchedInNoProxyRule(url, noProxyRule)).toBe(true);
  });

  it('should match to a long FQDN domain', () => {
    const noProxyRule = 'localhost,git.acme.com,127.0.0.1';
    const url = 'https://host.hostname.git.acme.com/username/repo-name';
    expect(isUrlMatchedInNoProxyRule(url, noProxyRule)).toBe(true);
  });

  it('should not match partial domain', () => {
    const noProxyRule = 'google.com';
    const url = 'https://oogle.com/username/repo-name';
    expect(isUrlMatchedInNoProxyRule(url, noProxyRule)).toBe(false);
  });

  it('should match domain starting with a dot', () => {
    const noProxyRule = 'localhost,.acme.com,127.0.0.1';
    const url = 'https://git.acme.com/username/repo-name';
    expect(isUrlMatchedInNoProxyRule(url, noProxyRule)).toBe(true);
  });

  it('should match domain starting with a wildcard', () => {
    const noProxyRule = 'localhost,*.acme.com,127.0.0.1';
    const url = 'https://git.acme.com/username/repo-name';
    expect(isUrlMatchedInNoProxyRule(url, noProxyRule)).toBe(true);
  });

  it('should match domain starting with a dot and a wildcard', () => {
    const noProxyRule = '.*.acme.com';
    const url = 'https://git.acme.com/username/repo-name';
    expect(isUrlMatchedInNoProxyRule(url, noProxyRule)).toBe(true);
  });

  it('should not match domain with interior wildcard', () => {
    const noProxyRule = 'git.*.com';
    const url = 'https://git.acme.com/username/repo-name';
    expect(isUrlMatchedInNoProxyRule(url, noProxyRule)).toBe(false);
  });

  it('should match with no port', () => {
    const noProxyRule = 'localhost';
    const url = 'https://localhost:8080/username/repo-name';
    expect(isUrlMatchedInNoProxyRule(url, noProxyRule)).toBe(true);
  });

  it('should match with port', () => {
    const noProxyRule = 'localhost:8080';
    const url = 'https://localhost:8080/username/repo-name';
    expect(isUrlMatchedInNoProxyRule(url, noProxyRule)).toBe(true);
  });

  it('should not match with wrong port', () => {
    const noProxyRule = 'localhost:8081';
    const url = 'https://localhost:8080/username/repo-name';
    expect(isUrlMatchedInNoProxyRule(url, noProxyRule)).toBe(false);
  });

  it('should match with port and no hostname', () => {
    const noProxyRule = ':8080';
    const url = 'https://localhost:8080/username/repo-name';
    expect(isUrlMatchedInNoProxyRule(url, noProxyRule)).toBe(true);
  });

  it('should match with inferred port 80 from hostname', () => {
    const noProxyRule = 'localhost:80';
    const url = 'http://localhost/username/repo-name';
    expect(isUrlMatchedInNoProxyRule(url, noProxyRule)).toBe(true);
  });

  it('should match with inferred port 443 from hostname', () => {
    const noProxyRule = 'localhost:443';
    const url = 'https://localhost/username/repo-name';
    expect(isUrlMatchedInNoProxyRule(url, noProxyRule)).toBe(true);
  });

  it('should not match with wrong inferred port from hostname', () => {
    const noProxyRule = 'localhost:8081';
    const url = 'https://localhost/username/repo-name';
    expect(isUrlMatchedInNoProxyRule(url, noProxyRule)).toBe(false);
  });

});
