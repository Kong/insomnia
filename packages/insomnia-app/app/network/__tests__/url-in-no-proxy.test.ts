import { globalBeforeEach } from '../../__jest__/before-each';
import { urlInNoProxy } from '../url-in-no-proxy';

describe('urlInNoProxy - noProxy hostname and wildcard matches', () => {
  beforeEach(globalBeforeEach);

  it('should handle poorly formatted url', () => {
    const noProxy = 'localhost,127.0.0.1';
    const url = '';
    expect(urlInNoProxy(url, noProxy)).toBe(false);
  });

  it('should handle poorly formatted noProxy', () => {
    const noProxy = null;
    const url = 'https://git.acme.com/username/repo-name';
    expect(urlInNoProxy(url, noProxy)).toBe(false);
  });

  it('should handle basic filtering', () => {
    const noProxy = 'localhost,git.acme.com,127.0.0.1,,,';
    const url = 'https://127.0.0.1/username/repo-name';
    expect(urlInNoProxy(url, noProxy)).toBe(true);
  });

  it('should handle basic filtering with trailing dot', () => {
    const noProxy = 'localhost.,git.acme.com,127.0.0.1';
    const url = 'https://localhost/username/repo-name';
    expect(urlInNoProxy(url, noProxy)).toBe(true);
  });

  it('should match an exact domain', () => {
    const noProxy = 'localhost,git.acme.com,127.0.0.1';
    const url = 'https://git.acme.com/username/repo-name';
    expect(urlInNoProxy(url, noProxy)).toBe(true);
  });

  it('should match to a FQDN domain', () => {
    const noProxy = 'localhost,git.acme.com,127.0.0.1';
    const url = 'https://hostname.git.acme.com/username/repo-name';
    expect(urlInNoProxy(url, noProxy)).toBe(true);
  });

  it('should match to a long FQDN domain', () => {
    const noProxy = 'localhost,git.acme.com,127.0.0.1';
    const url = 'https://host.hostname.git.acme.com/username/repo-name';
    expect(urlInNoProxy(url, noProxy)).toBe(true);
  });

  it('should not match partial domain', () => {
    const noProxy = 'google.com';
    const url = 'https://oogle.com/username/repo-name';
    expect(urlInNoProxy(url, noProxy)).toBe(false);
  });

  it('should match domain starting with a dot', () => {
    const noProxy = 'localhost,.acme.com,127.0.0.1';
    const url = 'https://git.acme.com/username/repo-name';
    expect(urlInNoProxy(url, noProxy)).toBe(true);
  });

  it('should match domain starting with a wildcard', () => {
    const noProxy = 'localhost,*.acme.com,127.0.0.1';
    const url = 'https://git.acme.com/username/repo-name';
    expect(urlInNoProxy(url, noProxy)).toBe(true);
  });

  it('should match domain starting with a dot and a wildcard', () => {
    const noProxy = '.*.acme.com';
    const url = 'https://git.acme.com/username/repo-name';
    expect(urlInNoProxy(url, noProxy)).toBe(true);
  });

  it('should not match domain with interior wildcard', () => {
    const noProxy = 'git.*.com';
    const url = 'https://git.acme.com/username/repo-name';
    expect(urlInNoProxy(url, noProxy)).toBe(false);
  });

  it('should match with no port', () => {
    const noProxy = 'localhost';
    const url = 'https://localhost:8080/username/repo-name';
    expect(urlInNoProxy(url, noProxy)).toBe(true);
  });

  it('should match with port', () => {
    const noProxy = 'localhost:8080';
    const url = 'https://localhost:8080/username/repo-name';
    expect(urlInNoProxy(url, noProxy)).toBe(true);
  });

  it('should not match with wrong port', () => {
    const noProxy = 'localhost:8081';
    const url = 'https://localhost:8080/username/repo-name';
    expect(urlInNoProxy(url, noProxy)).toBe(false);
  });

  it('should match with port and no hostname', () => {
    const noProxy = ':8080';
    const url = 'https://localhost:8080/username/repo-name';
    expect(urlInNoProxy(url, noProxy)).toBe(true);
  });

});
