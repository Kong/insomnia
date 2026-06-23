import { describe, expect, it } from 'vitest';

import { isPrivateOrLoopbackHost } from '../private-host';

describe('isPrivateOrLoopbackHost', () => {
  describe('localhost', () => {
    it('rejects "localhost"', () => {
      expect(isPrivateOrLoopbackHost('localhost')).toBe(true);
    });

    it('rejects subdomains of localhost', () => {
      expect(isPrivateOrLoopbackHost('app.localhost')).toBe(true);
      expect(isPrivateOrLoopbackHost('foo.bar.localhost')).toBe(true);
    });
  });

  describe('loopback addresses', () => {
    it('rejects IPv4 loopback', () => {
      expect(isPrivateOrLoopbackHost('127.0.0.1')).toBe(true);
      expect(isPrivateOrLoopbackHost('127.255.255.255')).toBe(true);
    });

    it('rejects 0.0.0.0/8 unspecified addresses', () => {
      expect(isPrivateOrLoopbackHost('0.0.0.0')).toBe(true);
      expect(isPrivateOrLoopbackHost('0.255.255.255')).toBe(true);
    });

    it('rejects IPv6 loopback', () => {
      expect(isPrivateOrLoopbackHost('::1')).toBe(true);
    });

    it('rejects IPv6 loopback in bracket notation', () => {
      expect(isPrivateOrLoopbackHost('[::1]')).toBe(true);
    });
  });

  describe('private IP ranges', () => {
    it('rejects 10.x.x.x addresses', () => {
      expect(isPrivateOrLoopbackHost('10.0.0.1')).toBe(true);
      expect(isPrivateOrLoopbackHost('10.255.255.255')).toBe(true);
    });

    it('rejects 172.16.x.x–172.31.x.x addresses', () => {
      expect(isPrivateOrLoopbackHost('172.16.0.1')).toBe(true);
      expect(isPrivateOrLoopbackHost('172.31.255.255')).toBe(true);
    });

    it('rejects 192.168.x.x addresses', () => {
      expect(isPrivateOrLoopbackHost('192.168.0.1')).toBe(true);
      expect(isPrivateOrLoopbackHost('192.168.255.255')).toBe(true);
    });

    it('rejects link-local addresses (169.254.x.x)', () => {
      expect(isPrivateOrLoopbackHost('169.254.169.254')).toBe(true);
    });

    it('rejects IPv6 private (fc00::/7)', () => {
      expect(isPrivateOrLoopbackHost('fc00::1')).toBe(true);
      expect(isPrivateOrLoopbackHost('fd00::1')).toBe(true);
    });
  });

  describe('public addresses', () => {
    it('allows public IPv4 addresses', () => {
      expect(isPrivateOrLoopbackHost('93.184.216.34')).toBe(false);
      expect(isPrivateOrLoopbackHost('8.8.8.8')).toBe(false);
      expect(isPrivateOrLoopbackHost('1.1.1.1')).toBe(false);
    });

    it('allows public IPv6 addresses', () => {
      expect(isPrivateOrLoopbackHost('2606:2800:220:1:248:1893:25c8:1946')).toBe(false);
    });

    it('allows public hostnames', () => {
      expect(isPrivateOrLoopbackHost('example.com')).toBe(false);
      expect(isPrivateOrLoopbackHost('api.github.com')).toBe(false);
    });

    it('returns false for non-IP hostnames that are not localhost', () => {
      // ipaddr.js cannot parse these so isValid returns false → returns false
      expect(isPrivateOrLoopbackHost('not-an-ip')).toBe(false);
      expect(isPrivateOrLoopbackHost('')).toBe(false);
    });
  });
});
