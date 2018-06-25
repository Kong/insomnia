import { urlMatchesCertHost } from '../url-matches-cert-host';
import { globalBeforeEach } from '../../__jest__/before-each';

describe('urlMatchesCertHost', () => {
  beforeEach(globalBeforeEach);
  describe('when the certificate host has no wildcard', () => {
    beforeEach(globalBeforeEach);
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

    it('should return false if the request URL and certificate host have different ports', () => {
      const requestUrl = 'https://www.example.org:1234/some/resources?query=1';
      const certificateHost = 'https://www.example.org:123';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(false);
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
  });

  describe('when using wildcard certificate hosts', () => {
    beforeEach(globalBeforeEach);
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

    it('should return true if certificate host has wildcard port', () => {
      const requestUrl = 'http://localhost:3000/some/resources?query=1';
      const certificateHost = 'localhost:*';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(true);
    });

    it('should return true if certificate host has wildcard in middle of port', () => {
      const requestUrl = 'http://localhost:3000/some/resources?query=1';
      const certificateHost = 'localhost:3*';
      expect(urlMatchesCertHost(certificateHost, requestUrl)).toBe(true);
    });
  });

  describe('when an invalid certificate host is supplied', () => {
    beforeEach(globalBeforeEach);
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
  });
});
