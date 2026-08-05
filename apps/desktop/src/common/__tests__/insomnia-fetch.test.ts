import { afterEach, describe, expect, it, vi } from 'vitest';

import { insomniaFetch, setFetchImplementation } from '../insomnia-fetch';

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

afterEach(() => {
  setFetchImplementation((input, init) => globalThis.fetch(input, init));
});

describe('insomniaFetch', () => {
  it('uses the injected fetch implementation', async () => {
    const impl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    setFetchImplementation(impl);

    const result = await insomniaFetch<{ ok: boolean }>({
      method: 'GET',
      path: '/v1/test',
      sessionId: 'ses_123',
      origin: 'https://api.test',
    });

    expect(result).toEqual({ ok: true });
    expect(impl).toHaveBeenCalledTimes(1);
    const [url, init] = impl.mock.calls[0];
    expect(url).toBe('https://api.test/v1/test');
    expect(init.headers['X-Session-Id']).toBe('ses_123');
  });

  it('appends the error cause to opaque fetch failures', async () => {
    setFetchImplementation(() => {
      const err = new TypeError('fetch failed');
      (err as Error & { cause?: unknown }).cause = { code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' };
      return Promise.reject(err);
    });

    await expect(insomniaFetch({ method: 'GET', path: '/v1/test', sessionId: 'ses_123' })).rejects.toThrow(
      'fetch failed (UNABLE_TO_GET_ISSUER_CERT_LOCALLY)',
    );
  });

  it('falls back to the cause message when there is no code', async () => {
    setFetchImplementation(() => {
      const err = new TypeError('fetch failed');
      (err as Error & { cause?: unknown }).cause = { message: 'proxy connection refused' };
      return Promise.reject(err);
    });

    await expect(insomniaFetch({ method: 'GET', path: '/v1/test', sessionId: 'ses_123' })).rejects.toThrow(
      'fetch failed (proxy connection refused)',
    );
  });

  it('surfaces the code from an AggregateError cause with an empty message', async () => {
    setFetchImplementation(() => {
      const err = new TypeError('fetch failed');
      const connectError = Object.assign(new Error('connect ECONNREFUSED ::1:443'), { code: 'ECONNREFUSED' });
      // eslint-disable-next-line unicorn/error-message -- empty message is the point
      (err as Error & { cause?: unknown }).cause = new AggregateError([connectError], '');
      return Promise.reject(err);
    });

    await expect(insomniaFetch({ method: 'GET', path: '/v1/test', sessionId: 'ses_123' })).rejects.toThrow(
      'fetch failed (ECONNREFUSED)',
    );
  });

  it('appends a string cause', async () => {
    setFetchImplementation(() => {
      const err = new TypeError('fetch failed');
      (err as Error & { cause?: unknown }).cause = 'certificate has expired';
      return Promise.reject(err);
    });

    await expect(insomniaFetch({ method: 'GET', path: '/v1/test', sessionId: 'ses_123' })).rejects.toThrow(
      'fetch failed (certificate has expired)',
    );
  });

  it('rethrows errors without a cause unchanged', async () => {
    setFetchImplementation(() => Promise.reject(new TypeError('fetch failed')));

    await expect(insomniaFetch({ method: 'GET', path: '/v1/test', sessionId: 'ses_123' })).rejects.toThrow(
      /^fetch failed$/,
    );
  });

  it('passes non-Error rejections through untouched', async () => {
    setFetchImplementation(() => Promise.reject('boom'));

    await expect(insomniaFetch({ method: 'GET', path: '/v1/test', sessionId: 'ses_123' })).rejects.toBe('boom');
  });

  it('reports timeouts with method and path', async () => {
    setFetchImplementation(() => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError')));

    await expect(insomniaFetch({ method: 'POST', path: '/v1/slow', sessionId: 'ses_123' })).rejects.toThrow(
      'insomniaFetch timed out: POST /v1/slow',
    );
  });

  it('reports aborts as timeouts', async () => {
    setFetchImplementation(() => Promise.reject(new DOMException('The operation was aborted.', 'AbortError')));

    await expect(insomniaFetch({ method: 'GET', path: '/v1/test', sessionId: 'ses_123' })).rejects.toThrow(
      'insomniaFetch timed out: GET /v1/test',
    );
  });
});
