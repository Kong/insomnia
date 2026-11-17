import dns from 'node:dns/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchPublicHttps, validatedLookup } from '../safe-fetch';

vi.mock('node:dns/promises', () => ({ default: { lookup: vi.fn() } }));

const lookup = (hostname: string, options: { all?: boolean } = {}) =>
  new Promise<{ err: Error | null; address?: unknown; family?: number }>(resolve => {
    void validatedLookup(hostname, options, (err, address, family) => resolve({ err, address, family }));
  });

describe('validatedLookup', () => {
  beforeEach(() => {
    vi.mocked(dns.lookup).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the validated addresses of a public host', async () => {
    const records = [{ address: '93.184.215.14', family: 4 }];
    vi.mocked(dns.lookup).mockResolvedValue(records as any);

    expect(await lookup('example.com', { all: true })).toEqual({ err: null, address: records, family: undefined });
    expect(await lookup('example.com')).toEqual({ err: null, address: '93.184.215.14', family: 4 });
  });

  it.each(['127.0.0.1', '10.0.0.5', '192.168.1.1', '169.254.169.254', '::1', 'fd00::1'])(
    'rejects a host that resolves to %s',
    async address => {
      vi.mocked(dns.lookup).mockResolvedValue([{ address, family: address.includes(':') ? 6 : 4 }] as any);

      const { err } = await lookup('internal.example.com', { all: true });

      expect(err?.message).toContain('resolves to a private or loopback address');
    },
  );

  it('rejects a host when any of its addresses is private', async () => {
    vi.mocked(dns.lookup).mockResolvedValue([
      { address: '93.184.215.14', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ] as any);

    expect((await lookup('mixed.example.com', { all: true })).err).toBeInstanceOf(Error);
  });

  it('validates every lookup, so a DNS answer that changes between lookups is still rejected', async () => {
    vi.mocked(dns.lookup)
      .mockResolvedValueOnce([{ address: '93.184.215.14', family: 4 }] as any)
      .mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }] as any);

    expect((await lookup('rebind.example.com', { all: true })).err).toBeNull();
    expect((await lookup('rebind.example.com', { all: true })).err).toBeInstanceOf(Error);
  });

  it('passes through DNS errors', async () => {
    vi.mocked(dns.lookup).mockRejectedValue(new Error('ENOTFOUND'));

    expect((await lookup('missing.example.com')).err?.message).toBe('ENOTFOUND');
  });
});

describe('fetchPublicHttps', () => {
  it.each([
    ['http URLs', 'http://example.com/a.json'],
    ['localhost', 'https://localhost/a.json'],
    ['private IP literals', 'https://192.168.0.1/a.json'],
    ['loopback IP literals', 'https://127.0.0.1/a.json'],
  ])('rejects %s without any network access', async (_label, href) => {
    await expect(fetchPublicHttps(href)).rejects.toThrow('Only https URLs to public hosts are allowed');
  });
});
