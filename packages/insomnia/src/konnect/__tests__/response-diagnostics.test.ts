import { describe, expect, it } from 'vitest';

import { formatRateLimitObservation, readRateLimitObservation } from '../response-diagnostics';

const headers = (...entries: [string, string][]) => entries.map(([name, value]) => ({ name, value }));

describe('readRateLimitObservation', () => {
  it('reads the suffixed window headers from the response', () => {
    const observation = readRateLimitObservation(
      headers(
        ['X-RateLimit-Limit-Minute', '20'],
        ['X-RateLimit-Remaining-Minute', '16'],
        ['X-RateLimit-Limit-Hour', '300'],
        ['x-ratelimit-remaining-hour', '295'],
      ),
    );

    expect(observation?.windows).toEqual([
      { unit: 'minute', limit: 20, remaining: 16 },
      { unit: 'hour', limit: 300, remaining: 295 },
    ]);
  });

  it('keeps a window that only reports a remaining count', () => {
    const observation = readRateLimitObservation(headers(['X-RateLimit-Remaining-Minute', '4']));

    expect(observation?.windows).toEqual([{ unit: 'minute', limit: null, remaining: 4 }]);
  });

  it('keeps a window that only reports a limit', () => {
    const observation = readRateLimitObservation(headers(['X-RateLimit-Limit-Minute', '20']));

    expect(observation?.windows).toEqual([{ unit: 'minute', limit: 20, remaining: null }]);
  });

  it('falls back to the un-windowed draft headers', () => {
    const observation = readRateLimitObservation(
      headers(['RateLimit-Limit', '20'], ['RateLimit-Remaining', '7'], ['RateLimit-Reset', '42']),
    );

    expect(observation).toEqual({
      windows: [{ unit: null, limit: 20, remaining: 7 }],
      resetSeconds: 42,
      retryAfterSeconds: null,
      headersUsed: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    });
  });

  it('records which headers the observation came from', () => {
    const observation = readRateLimitObservation(
      headers(['X-RateLimit-Limit-Minute', '20'], ['X-RateLimit-Remaining-Minute', '16'], ['Retry-After', '30']),
    );

    expect(observation?.headersUsed).toEqual([
      'X-RateLimit-Limit-Minute',
      'X-RateLimit-Remaining-Minute',
      'Retry-After',
    ]);
  });

  it('reads Retry-After from an exhausted response', () => {
    const observation = readRateLimitObservation(
      headers(['X-RateLimit-Remaining-Minute', '0'], ['Retry-After', '30']),
    );

    expect(observation?.retryAfterSeconds).toBe(30);
  });

  it('keeps a throttled response that only carries Retry-After', () => {
    const observation = readRateLimitObservation(headers(['Retry-After', '30']));

    expect(observation).toEqual({
      windows: [],
      resetSeconds: null,
      retryAfterSeconds: 30,
      headersUsed: ['Retry-After'],
    });
  });

  it('reports nothing when the response carries no rate limit headers', () => {
    expect(readRateLimitObservation(headers(['Content-Type', 'application/json']))).toBeNull();
  });
});

describe('formatRateLimitObservation', () => {
  it('renders remaining of limit per window', () => {
    const observation = readRateLimitObservation(
      headers(
        ['X-RateLimit-Limit-Minute', '20'],
        ['X-RateLimit-Remaining-Minute', '16'],
        ['X-RateLimit-Limit-Hour', '300'],
        ['X-RateLimit-Remaining-Hour', '295'],
      ),
    );

    expect(formatRateLimitObservation(observation!)).toBe('16 of 20 left this minute, 295 of 300 left this hour');
  });

  it('omits the window name for the draft headers and appends the reset', () => {
    const observation = readRateLimitObservation(
      headers(['RateLimit-Limit', '20'], ['RateLimit-Remaining', '7'], ['RateLimit-Reset', '42']),
    );

    expect(formatRateLimitObservation(observation!)).toBe('7 of 20 left, reset 42s after this response');
  });

  it('renders a limit without a remaining count as allowed', () => {
    const observation = readRateLimitObservation(headers(['X-RateLimit-Limit-Minute', '20']));

    expect(formatRateLimitObservation(observation!)).toBe('20 allowed this minute');
  });
});
