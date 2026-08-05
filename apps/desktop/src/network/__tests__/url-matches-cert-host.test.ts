import { describe, expect, it } from 'vitest';

import { urlMatchesCertHost } from '../url-matches-cert-host';

describe('urlMatchesCertHost', () => {
  describe('when the certificate host has no wildcard', () => {
    it('should return false if the requested host does not match the certificate host', () => {
      const requestUrl = 'https://www.example.org';
      const certificateHost = 'https://www.example.com';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(false);
    });

    it('should return true if the request URL and the certificate host exactly match', () => {
      const requestUrl = 'https://www.example.org';
      const certificateHost = 'https://www.example.org';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(true);
    });

    it('should return true if the request URL has the same host as the certificate host and no ports are specified', () => {
      const requestUrl = 'https://www.example.org/some/resources?query=1';
      const certificateHost = 'https://www.example.org';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(true);
    });

    it('should return true if the request URL has the same host and port as the certificate host', () => {
      const requestUrl = 'https://www.example.org:1234/some/resources?query=1';
      const certificateHost = 'https://www.example.org:1234';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(true);
    });

    it('should return true if the request URL uses an IPv4 host with an explicit port', () => {
      const requestUrl = 'http://127.0.0.1:4010';
      const certificateHost = 'http://127.0.0.1:4010';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(true);
    });

    it('should return false if the request URL and certificate host have different ports', () => {
      const requestUrl = 'https://www.example.org:1234/some/resources?query=1';
      const certificateHost = 'https://www.example.org:123';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(false);
    });

    it('should return true if the request URL and certificate host have different ports and the needCheckPort parameter is false', () => {
      const requestUrl = 'https://www.example.org:1234/some/resources?query=1';
      const certificateHost = 'https://www.example.org:123';
      expect(urlMatchesCertHost(certificateHost, requestUrl, false)).toBe(true);
    });

    it('should return true if the certificate has the same host and dose not specifies the port, when needCheckPort parameter is false', () => {
      const requestUrl = 'https://www.example.org:1234/some/resources?query=1';
      const certificateHost = 'https://www.example.org';
      expect(urlMatchesCertHost(certificateHost, requestUrl, false)).toBe(true);
    });

    it('should return true if the request URL has a port of 443 and the certificate host has no port', () => {
      const requestUrl = 'https://www.example.org:443/some/resources?query=1';
      const certificateHost = 'https://www.example.org';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(true);
    });

    it('should return true if the request URL has no port and the certificate host has a port of 443', () => {
      const requestUrl = 'https://www.example.org/some/resources?query=1';
      const certificateHost = 'https://www.example.org:443';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(true);
    });

    it('should return true if the request URL is https and the certificate host has no protocol', () => {
      const requestUrl = 'https://www.example.org/some/resources?query=1';
      const certificateHost = 'https://www.example.org';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(true);
    });

    it('should return false if an IPv4 request URL and certificate host use different ports', () => {
      const requestUrl = 'http://127.0.0.1:4010';
      const certificateHost = 'http://127.0.0.1:4011';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(false);
    });
  });

  describe('when using wildcard certificate hosts', () => {
    it('should return true if the certificate host is only a wildcard', () => {
      const requestUrl = 'https://www.example.org/some/resources?query=1';
      const certificateHost = '*';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(true);
    });

    it('should return true if the request URL host matches a certificate host with a wildcard prefix', () => {
      const requestUrl = 'https://my.example.org/some/resources?query=1';
      const certificateHost = 'https://*.example.org';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(true);
    });

    it('should return true if the request URL host matches a certificate host with a wildcard in a central position', () => {
      const requestUrl = 'https://my.example.org/some/resources?query=1';
      const certificateHost = 'https://my.*.org';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(true);
    });

    it('should return true if the request URL host matches a certificate host with a wildcard suffix', () => {
      const requestUrl = 'https://my.example.org/some/resources?query=1';
      const certificateHost = 'https://my.example.*';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(true);
    });

    it('should return true if the request URL host matches a certificate host with multiple wildcards', () => {
      const requestUrl = 'https://my.example.stage.org/some/resources?query=1';
      const certificateHost = 'https://*.example*.org';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(true);
    });

    it('should return true if the request URL host matches a wildcard-prefixed certificate host without a dot separator', () => {
      const requestUrl = 'https://my.example.org/some/resources?query=1';
      const certificateHost = '*example.org';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(true);
    });

    it('should return true if the request URL host exactly ends with the wildcard-prefixed certificate host', () => {
      const requestUrl = 'https://example.org/some/resources?query=1';
      const certificateHost = '*example.org';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(true);
    });

    it('should return false if the request URL host does not match the certificate host', () => {
      const requestUrl = 'https://my.example.com/some/resources?query=1';
      const certificateHost = 'https://*.example.org';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(false);
    });

    it('should return false if the request URL and certificate host ports do not match', () => {
      const requestUrl = 'https://my.example.org:123/some/resources?query=1';
      const certificateHost = 'https://*.example.org:456';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(false);
    });

    it('should return true if the request URL has a port of 443 and the certificate host has no port', () => {
      const requestUrl = 'https://www.example.org:443/some/resources?query=1';
      const certificateHost = 'https://*.example.org';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(true);
    });

    it('should return true if the request URL has no port and the certificate host has a port of 443', () => {
      const requestUrl = 'https://www.example.org/some/resources?query=1';
      const certificateHost = 'https://*.example.org:443';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(true);
    });

    it('should return true if the request URL is https and the certificate host has no protocol', () => {
      const requestUrl = 'https://www.example.org/some/resources?query=1';
      const certificateHost = '*.example.org';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(true);
    });

    it('should return true if the certificate URL host match the request host and dose not specifies the port, when needCheckPort parameter is false', () => {
      const requestUrl = 'https://www.example.org:1234/some/resources?query=1';
      const certificateHost = 'https://*.example.org';
      expect(urlMatchesCertHost(certificateHost, requestUrl, false)).toBe(true);
    });
  });

  describe('when an invalid certificate host is supplied', () => {
    it('should return false if the certificate host contains invalid characters', () => {
      const requestUrl = 'https://www.example.org/some/resources?query=1';
      const certificateHost = 'https://example!.org';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(false);
    });

    it('should return false if the certificate protocol contains invalid characters', () => {
      const requestUrl = 'https://www.example.org/some/resources?query=1';
      const certificateHost = 'https!://example.org';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(false);
    });

    it('should return false if the certificate host contains regular expression special characters', () => {
      const requestUrl = 'https://www.example.org/some/resources?query=1';
      const certificateHost = 'https://example.org?';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(false);
    });

    it('should return false if the request URL is invalid', () => {
      expect(urlMatchesCertHost('example.com', 'not-a-valid-url')).toBe(false);
    });
  });

  describe('when using HTTP request URLs', () => {
    it('should return true if the HTTP request URL matches the certificate host by hostname', () => {
      const requestUrl = 'http://www.example.org/some/resources?query=1';
      const certificateHost = 'www.example.org';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(true);
    });

    it('should return true if the HTTP request URL with an explicit non-default port matches the certificate host', () => {
      const requestUrl = 'http://www.example.org:8080/some/resources?query=1';
      const certificateHost = 'www.example.org:8080';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(true);
    });

    it('should return false if the HTTP request URL and the certificate host have different ports', () => {
      const requestUrl = 'http://www.example.org:8080/some/resources?query=1';
      const certificateHost = 'www.example.org:9090';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(false);
    });

    it('should return true if the HTTP request URL host matches a wildcard certificate host', () => {
      const requestUrl = 'http://my.example.org/some/resources?query=1';
      const certificateHost = '*.example.org';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(true);
    });

    it('should return false if the HTTP request URL host does not match the certificate host', () => {
      const requestUrl = 'http://www.example.org/some/resources?query=1';
      const certificateHost = 'www.example.com';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(false);
    });
  });

  describe('when using IPv4 addresses', () => {
    it('should return true if the request URL and certificate host use the same IPv4 address', () => {
      expect(urlMatchesCertHost('192.168.1.1', 'https://192.168.1.1/')).toBe(true);
    });

    it('should return true if the request URL and certificate host use the same IPv4 address and port', () => {
      expect(urlMatchesCertHost('192.168.1.1:8443', 'https://192.168.1.1:8443/')).toBe(true);
    });

    it('should return false if the request URL and certificate host use different IPv4 addresses', () => {
      expect(urlMatchesCertHost('192.168.1.1', 'https://192.168.1.2/')).toBe(false);
    });

    it('should return true if the certificate host uses a wildcard with an IPv4-like pattern', () => {
      expect(urlMatchesCertHost('192.168.1.*', 'https://192.168.1.100/')).toBe(true);
    });

    it('should return false if the request URL has a different IPv4 subnet than the certificate wildcard', () => {
      expect(urlMatchesCertHost('192.168.1.*', 'https://192.168.2.100/')).toBe(false);
    });
  });

  describe('when using IPv6 addresses', () => {
    it('should return true if the request URL and certificate host both use the same IPv6 address', () => {
      expect(urlMatchesCertHost('[::1]', 'https://[::1]/')).toBe(true);
    });

    it('should return true if the request URL and certificate host both use the same IPv6 address and port', () => {
      expect(urlMatchesCertHost('[::1]:8443', 'https://[::1]:8443/')).toBe(true);
    });

    it('should return false if the request URL and certificate host use different IPv6 addresses', () => {
      expect(urlMatchesCertHost('[::1]', 'https://[::2]/')).toBe(false);
    });
  });
});
