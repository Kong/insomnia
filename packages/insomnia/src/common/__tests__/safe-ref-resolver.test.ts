import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { safeRefResolver } from '../safe-ref-resolver';

function getHttpResolver() {
  return (safeRefResolver as any).resolvers.http;
}

describe('safeHttpResolver', () => {
  const httpResolver = getHttpResolver();

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('URL validation', () => {
    it('rejects invalid URLs', async () => {
      await expect(
        httpResolver.resolve({
          href: () => 'not-a-url',
        }),
      ).rejects.toThrow('Failed to resolve $ref "not-a-url"');

      expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects relative URLs', async () => {
      await expect(
        httpResolver.resolve({
          href: () => '/foo/bar.yaml',
        }),
      ).rejects.toThrow('Failed to resolve $ref "/foo/bar.yaml"');

      expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects http URLs', async () => {
      await expect(
        httpResolver.resolve({
          href: () => 'http://example.com/schema.yaml',
        }),
      ).rejects.toThrow('only https URLs to public hosts are allowed');

      expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects ftp URLs', async () => {
      await expect(
        httpResolver.resolve({
          href: () => 'ftp://example.com/schema.yaml',
        }),
      ).rejects.toThrow('only https URLs to public hosts are allowed');

      expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects localhost', async () => {
      await expect(
        httpResolver.resolve({
          href: () => 'https://localhost/schema.yaml',
        }),
      ).rejects.toThrow('only https URLs to public hosts are allowed');

      expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects loopback IPv4 addresses', async () => {
      await expect(
        httpResolver.resolve({
          href: () => 'https://127.0.0.1/schema.yaml',
        }),
      ).rejects.toThrow('only https URLs to public hosts are allowed');

      expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects private IPv4 addresses', async () => {
      const urls = [
        'https://10.0.0.1/schema.yaml',
        'https://172.16.0.1/schema.yaml',
        'https://192.168.1.1/schema.yaml',
      ];

      for (const url of urls) {
        await expect(
          httpResolver.resolve({
            href: () => url,
          }),
        ).rejects.toThrow('only https URLs to public hosts are allowed');
      }

      expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects link-local IP addresses', async () => {
      await expect(
        httpResolver.resolve({
          href: () => 'https://169.254.169.254/latest/meta-data',
        }),
      ).rejects.toThrow('only https URLs to public hosts are allowed');

      expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects IPv6 loopback addresses', async () => {
      await expect(
        httpResolver.resolve({
          href: () => 'https://[::1]/schema.yaml',
        }),
      ).rejects.toThrow('only https URLs to public hosts are allowed');

      expect(fetch).not.toHaveBeenCalled();
    });

    it('allows public HTTPS URLs', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('openapi: 3.1.0'),
      } as unknown as Response);

      const result = await httpResolver.resolve({
        href: () => 'https://example.com/schema.yaml',
      });

      expect(result).toBe('openapi: 3.1.0');

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith('https://example.com/schema.yaml');
    });

    it('allows HTTPS URLs with ports', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('ok'),
      } as unknown as Response);

      await expect(
        httpResolver.resolve({
          href: () => 'https://example.com:8443/schema.yaml',
        }),
      ).resolves.toBe('ok');

      expect(fetch).toHaveBeenCalledOnce();
    });

    it('allows HTTPS URLs with query strings', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('ok'),
      } as unknown as Response);

      await expect(
        httpResolver.resolve({
          href: () => 'https://example.com/schema.yaml?raw=1',
        }),
      ).resolves.toBe('ok');

      expect(fetch).toHaveBeenCalledOnce();
    });
  });

  describe('fetch handling', () => {
    it('returns response text for successful fetches', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('test-content'),
      } as unknown as Response);

      await expect(
        httpResolver.resolve({
          href: () => 'https://example.com/test.yaml',
        }),
      ).resolves.toBe('test-content');
    });

    it('throws on 404 responses', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as unknown as Response);

      await expect(
        httpResolver.resolve({
          href: () => 'https://example.com/missing.yaml',
        }),
      ).rejects.toThrow('Failed to fetch $ref "https://example.com/missing.yaml": 404 Not Found');
    });

    it('throws on 500 responses', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as unknown as Response);

      await expect(
        httpResolver.resolve({
          href: () => 'https://example.com/error.yaml',
        }),
      ).rejects.toThrow('Failed to fetch $ref "https://example.com/error.yaml": 500 Internal Server Error');
    });

    it('propagates fetch network errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('network failure'));

      await expect(
        httpResolver.resolve({
          href: () => 'https://example.com/schema.yaml',
        }),
      ).rejects.toThrow('network failure');
    });

    it('propagates response.text() failures', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: vi.fn().mockRejectedValue(new Error('failed reading body')),
      } as unknown as Response);

      await expect(
        httpResolver.resolve({
          href: () => 'https://example.com/schema.yaml',
        }),
      ).rejects.toThrow('failed reading body');
    });
  });

  describe('resolver wiring', () => {
    it('uses the same resolver for http and https keys', () => {
      // @ts-expect-error internal access for test verification
      const resolvers = safeRefResolver.resolvers;

      expect(resolvers.http).toBe(resolvers.https);
    });
  });
});
