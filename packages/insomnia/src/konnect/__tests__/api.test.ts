import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { extractRegionFromEndpoint, fetchAllControlPlanes, fetchAllServices, fetchRoutesForService, validatePat } from '../api';

vi.mock('../../common/constants', () => ({
  getKonnectApiBaseURL: () => 'https://global.api.konghq.com',
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function rateLimitResponse(retryAfter?: string): Response {
  const headers: Record<string, string> = {};
  if (retryAfter !== undefined) {
    headers['Retry-After'] = retryAfter;
  }
  return new Response('Too Many Requests', { status: 429, headers });
}

/**
 * Flush all pending timers (retries) without hardcoding delay values.
 *
 * Each retry iteration in fetchWithRetry does:
 *   1. setTimeout (pending timer)
 *   2. await the timeout → fires the callback
 *   3. await fetch() → microtask resolves the mock
 *   4. if still 429 → schedules the *next* setTimeout
 *
 * Between steps 2-4 the timer count is 0, so we can't rely on
 * `vi.getTimerCount()` alone. Instead we run a fixed number of
 * flush rounds (enough for MAX_RETRY_ATTEMPTS), yielding to
 * the microtask queue between each so the next timer can be
 * registered.
 */
async function drainRetryTimers(rounds = 10): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    // Yield to let pending microtasks (mock fetch resolutions) run
    // and register the next setTimeout if another retry is needed.
    await vi.runAllTimersAsync();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ─── extractRegionFromEndpoint ───────────────────────────────────────────────

describe('extractRegionFromEndpoint', () => {
  it('extracts "us" from a US control plane endpoint', () => {
    expect(extractRegionFromEndpoint('https://abc123.us.cp0.konghq.com')).toBe('us');
  });

  it('extracts "eu" from an EU control plane endpoint', () => {
    expect(extractRegionFromEndpoint('https://xyz789.eu.cp0.konghq.com')).toBe('eu');
  });

  it('extracts "au" from an AU control plane endpoint', () => {
    expect(extractRegionFromEndpoint('https://def456.au.cp0.konghq.com')).toBe('au');
  });

  it('extracts "me" from a ME control plane endpoint', () => {
    expect(extractRegionFromEndpoint('https://def456.me.cp0.konghq.com')).toBe('me');
  });

  it('extracts "in" from an IN control plane endpoint', () => {
    expect(extractRegionFromEndpoint('https://def456.in.cp0.konghq.com')).toBe('in');
  });

  it('defaults to "us" for a malformed URL', () => {
    expect(extractRegionFromEndpoint('not-a-url')).toBe('us');
  });

  it('defaults to "us" for an unexpected hostname format (no cp0 segment)', () => {
    expect(extractRegionFromEndpoint('https://api.konghq.com')).toBe('us');
  });

  it('defaults to "us" for an empty string', () => {
    expect(extractRegionFromEndpoint('')).toBe('us');
  });
});

// ─── validatePat ─────────────────────────────────────────────────────────────

describe('validatePat', () => {
  it('returns valid:true for a 200 response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await validatePat('good-token');

    expect(result).toEqual({ valid: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain('/v2/control-planes');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer good-token');
  });

  it('returns error for 401 Unauthorized', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));

    const result = await validatePat('bad-token');

    expect(result).toEqual({ valid: false, error: 'Invalid token (401 Unauthorized).' });
  });

  it('returns error for 403 Forbidden', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })));

    const result = await validatePat('limited-token');

    expect(result).toEqual({ valid: false, error: 'Token lacks permission to list control planes (403 Forbidden).' });
  });

  it('returns error for unexpected status codes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));

    const result = await validatePat('any-token');

    expect(result).toEqual({ valid: false, error: 'Konnect returned 500.' });
  });

  it('returns error when fetch throws a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

    const result = await validatePat('any-token');

    expect(result).toEqual({ valid: false, error: 'Network failure' });
  });

  it('returns generic error when fetch throws a non-Error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('kaboom'));

    const result = await validatePat('any-token');

    expect(result).toEqual({ valid: false, error: 'Could not reach Konnect.' });
  });
});

// ─── fetchAllControlPlanes — page-number pagination ──────────────────────────

describe('fetchAllControlPlanes', () => {
  it('yields a single page when total <= PAGE_SIZE', async () => {
    const cps = [{ id: 'cp-1', name: 'CP 1', description: '', config: { cluster_type: 'HYBRID', control_plane_endpoint: '' } }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ data: cps, meta: { page: { total: 1, size: 100, number: 1 } } }),
    ));

    const pages: any[][] = [];
    for await (const page of fetchAllControlPlanes('faketoken')) {
      pages.push(page);
    }

    expect(pages).toHaveLength(1);
    expect(pages[0]).toEqual(cps);
  });

  it('yields multiple pages when total > PAGE_SIZE', async () => {
    const page1Data = Array.from({ length: 100 }, (_, i) => ({
      id: `cp-${i}`, name: `CP ${i}`, description: '', config: { cluster_type: 'HYBRID', control_plane_endpoint: '' },
    }));
    const page2Data = [{ id: 'cp-100', name: 'CP 100', description: '', config: { cluster_type: 'HYBRID', control_plane_endpoint: '' } }];

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: page1Data, meta: { page: { total: 101, size: 100, number: 1 } } }))
      .mockResolvedValueOnce(jsonResponse({ data: page2Data, meta: { page: { total: 101, size: 100, number: 2 } } }));
    vi.stubGlobal('fetch', fetchMock);

    const pages: any[][] = [];
    for await (const page of fetchAllControlPlanes('faketoken')) {
      pages.push(page);
    }

    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(100);
    expect(pages[1]).toEqual(page2Data);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('page[number]=1');
    expect(fetchMock.mock.calls[1][0]).toContain('page[number]=2');
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));

    const gen = fetchAllControlPlanes('faketoken');
    await expect(gen.next()).rejects.toThrow('Konnect API error 500 fetching control planes');
  });

  it('yields empty data when total is 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ data: [], meta: { page: { total: 0, size: 100, number: 1 } } }),
    ));

    const pages: any[][] = [];
    for await (const page of fetchAllControlPlanes('faketoken')) {
      pages.push(page);
    }

    expect(pages).toHaveLength(1);
    expect(pages[0]).toEqual([]);
  });
});

// ─── fetchAllServices — offset pagination ────────────────────────────────────

describe('fetchAllServices', () => {
  it('fetches a single page when offset is null', async () => {
    const services = [{ id: 'svc-1', name: 'Svc', protocol: 'http', host: 'h', port: 80, path: null, enabled: true, tags: null }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: services, offset: null })));

    const result = await fetchAllServices('faketoken', 'cp-1', 'us');

    expect(result).toEqual(services);
  });

  it('follows offset pagination across multiple pages', async () => {
    const page1 = [{ id: 'svc-1', name: 'A', protocol: 'http', host: 'h', port: 80, path: null, enabled: true, tags: null }];
    const page2 = [{ id: 'svc-2', name: 'B', protocol: 'http', host: 'h', port: 80, path: null, enabled: true, tags: null }];

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: page1, offset: 'cursor-abc' }))
      .mockResolvedValueOnce(jsonResponse({ data: page2, offset: null }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchAllServices('faketoken', 'cp-1', 'us');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('svc-1');
    expect(result[1].id).toBe('svc-2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // First call should not have offset param
    expect(fetchMock.mock.calls[0][0]).not.toContain('offset=');
    // Second call should include the offset
    expect(fetchMock.mock.calls[1][0]).toContain('offset=cursor-abc');
  });

  it('uses the regional API base for the given region', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [], offset: null }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchAllServices('faketoken', 'cp-1', 'eu');

    expect(fetchMock.mock.calls[0][0]).toMatch(/^https:\/\/eu\.api\.konghq\.com/);
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 502 })));

    await expect(fetchAllServices('faketoken', 'cp-1', 'us')).rejects.toThrow('Konnect API error 502');
  });
});

// ─── fetchRoutesForService — offset pagination ──────────────────────────────

describe('fetchRoutesForService', () => {
  it('follows offset pagination across multiple pages', async () => {
    const page1 = [{ id: 'r-1', name: null, methods: ['GET'], paths: ['/a'], protocols: ['http'], hosts: null, headers: null, snis: null, expression: null, service: { id: 'svc-1' } }];
    const page2 = [{ id: 'r-2', name: null, methods: ['POST'], paths: ['/b'], protocols: ['http'], hosts: null, headers: null, snis: null, expression: null, service: { id: 'svc-1' } }];

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: page1, offset: 'cursor-xyz' }))
      .mockResolvedValueOnce(jsonResponse({ data: page2, offset: null }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchRoutesForService('faketoken', 'cp-1', 'svc-1', 'us');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('r-1');
    expect(result[1].id).toBe('r-2');
  });

  it('includes the service ID in the URL path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [], offset: null }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchRoutesForService('faketoken', 'cp-1', 'svc-42', 'us');

    expect(fetchMock.mock.calls[0][0]).toContain('/services/svc-42/routes');
  });
});

// ─── Retry logic (fetchWithRetry, tested through exported functions) ─────────

describe('retry on 429', () => {
  it('retries and succeeds after a single 429', async () => {
    const services = [{ id: 'svc-1', name: 'S', protocol: 'http', host: 'h', port: 80, path: null, enabled: true, tags: null }];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(rateLimitResponse())
      .mockResolvedValueOnce(jsonResponse({ data: services, offset: null }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchAllServices('faketoken', 'cp-1', 'us');
    await drainRetryTimers();

    const result = await promise;

    expect(result).toEqual(services);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses Retry-After header value in seconds when present', async () => {
    const services = [{ id: 'svc-1', name: 'S', protocol: 'http', host: 'h', port: 80, path: null, enabled: true, tags: null }];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(rateLimitResponse('3'))
      .mockResolvedValueOnce(jsonResponse({ data: services, offset: null }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchAllServices('faketoken', 'cp-1', 'us');

    // After 2.9s the retry should NOT have fired (Retry-After: 3 → 3000ms)
    await vi.advanceTimersByTimeAsync(2900);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // After another 200ms (total 3.1s) the retry should have fired
    await vi.advanceTimersByTimeAsync(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const result = await promise;
    expect(result).toEqual(services);
  });

  it('uses exponential backoff when Retry-After is missing', async () => {
    const services = [{ id: 'svc-1', name: 'S', protocol: 'http', host: 'h', port: 80, path: null, enabled: true, tags: null }];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(rateLimitResponse())
      .mockResolvedValueOnce(rateLimitResponse())
      .mockResolvedValueOnce(jsonResponse({ data: services, offset: null }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchAllServices('faketoken', 'cp-1', 'us');

    // First retry: default backoff = 1000 * 2^0 = 1s
    await vi.advanceTimersByTimeAsync(900);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Second retry: default backoff = 1000 * 2^1 = 2s (fires at ~3100ms cumulative)
    // We're at ~1100ms cumulative, so 1800ms more → 2900ms total, still short of 3000ms+
    await vi.advanceTimersByTimeAsync(1800);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(300);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const result = await promise;
    expect(result).toEqual(services);
  });

  it('gives up after MAX_RETRY_ATTEMPTS (5) and returns the 429 response', async () => {
    // 6 total calls: initial + 5 retries, all 429
    const fetchMock = vi.fn().mockResolvedValue(rateLimitResponse());
    vi.stubGlobal('fetch', fetchMock);

    let error: Error | undefined;
    const promise = fetchAllServices('faketoken', 'cp-1', 'us').catch((err: Error) => {
      error = err;
    });

    await drainRetryTimers();
    await promise;

    expect(error?.message).toMatch('Konnect API error 429');
    // 1 initial + 5 retries = 6 total calls
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('retries through all 5 attempts before succeeding', async () => {
    const services = [{ id: 'svc-1', name: 'S', protocol: 'http', host: 'h', port: 80, path: null, enabled: true, tags: null }];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(rateLimitResponse())   // attempt 0
      .mockResolvedValueOnce(rateLimitResponse())   // attempt 1
      .mockResolvedValueOnce(rateLimitResponse())   // attempt 2
      .mockResolvedValueOnce(rateLimitResponse())   // attempt 3
      .mockResolvedValueOnce(rateLimitResponse())   // attempt 4
      .mockResolvedValueOnce(jsonResponse({ data: services, offset: null }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchAllServices('faketoken', 'cp-1', 'us');
    await drainRetryTimers();

    const result = await promise;

    expect(result).toEqual(services);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('retries work across paginated requests', async () => {
    const page1 = [{ id: 'svc-1', name: 'A', protocol: 'http', host: 'h', port: 80, path: null, enabled: true, tags: null }];
    const page2 = [{ id: 'svc-2', name: 'B', protocol: 'http', host: 'h', port: 80, path: null, enabled: true, tags: null }];

    const fetchMock = vi.fn()
      // First page succeeds immediately
      .mockResolvedValueOnce(jsonResponse({ data: page1, offset: 'next' }))
      // Second page hits a 429 then succeeds
      .mockResolvedValueOnce(rateLimitResponse())
      .mockResolvedValueOnce(jsonResponse({ data: page2, offset: null }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchAllServices('faketoken', 'cp-1', 'us');
    await drainRetryTimers();

    const result = await promise;

    expect(result).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries work for fetchAllControlPlanes pagination', async () => {
    const page1Data = [{ id: 'cp-1', name: 'CP 1', description: '', config: { cluster_type: 'HYBRID', control_plane_endpoint: '' } }];

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(rateLimitResponse('1'))
      .mockResolvedValueOnce(jsonResponse({ data: page1Data, meta: { page: { total: 1, size: 100, number: 1 } } }));
    vi.stubGlobal('fetch', fetchMock);

    const pages: any[][] = [];
    const gen = fetchAllControlPlanes('faketoken');

    const iterPromise = (async () => {
      for await (const page of gen) {
        pages.push(page);
      }
    })();

    await drainRetryTimers();
    await iterPromise;

    expect(pages).toHaveLength(1);
    expect(pages[0]).toEqual(page1Data);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
