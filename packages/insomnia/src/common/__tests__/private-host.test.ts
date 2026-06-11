import { afterEach, describe, expect, it, vi } from 'vitest';

import { assertNotLoopbackUrl, isLoopbackHost, isPrivateOrLoopbackHost } from '../private-host';

const lookupMock = vi.hoisted(() => vi.fn());

vi.mock('node:dns/promises', () => ({
  default: { lookup: lookupMock },
}));

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

describe('isLoopbackHost', () => {
  it('treats localhost and *.localhost as loopback', () => {
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('app.localhost')).toBe(true);
  });

  it('treats 127.0.0.0/8, 0.0.0.0/8 and ::1 as loopback', () => {
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('127.255.255.255')).toBe(true);
    expect(isLoopbackHost('0.0.0.0')).toBe(true);
    expect(isLoopbackHost('::1')).toBe(true);
    expect(isLoopbackHost('[::1]')).toBe(true);
  });

  it('allows private LAN, link-local and ULA addresses (intentionally not loopback)', () => {
    expect(isLoopbackHost('10.0.0.5')).toBe(false);
    expect(isLoopbackHost('172.16.0.1')).toBe(false);
    expect(isLoopbackHost('192.168.1.2')).toBe(false);
    expect(isLoopbackHost('169.254.169.254')).toBe(false);
    expect(isLoopbackHost('fc00::1')).toBe(false);
    expect(isLoopbackHost('fe80::1')).toBe(false);
  });

  it('allows public addresses and hostnames', () => {
    expect(isLoopbackHost('8.8.8.8')).toBe(false);
    expect(isLoopbackHost('example.com')).toBe(false);
  });
});

describe('assertNotLoopbackUrl', () => {
  afterEach(() => {
    lookupMock.mockReset();
  });

  it('rejects a literal loopback host before resolving DNS', async () => {
    await expect(assertNotLoopbackUrl('http://127.0.0.1:4873/x.tgz')).rejects.toThrow(/loopback/);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('rejects a host that resolves to a loopback address (DNS rebinding)', async () => {
    lookupMock.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    await expect(assertNotLoopbackUrl('https://app.localtest.me/x.tgz')).rejects.toThrow(/loopback/);
  });

  it('allows a private-LAN registry (resolves to a private address)', async () => {
    lookupMock.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);
    const url = await assertNotLoopbackUrl('http://npm.internal.corp/x.tgz');
    expect(url.hostname).toBe('npm.internal.corp');
  });

  it('allows a public registry', async () => {
    lookupMock.mockResolvedValue([{ address: '104.16.0.1', family: 4 }]);
    const url = await assertNotLoopbackUrl('https://registry.npmjs.org/x.tgz');
    expect(url.href).toBe('https://registry.npmjs.org/x.tgz');
  });
});
