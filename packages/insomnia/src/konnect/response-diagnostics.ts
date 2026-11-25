import type { ResponseHeader } from 'insomnia-data';

/** Windows Kong sends a suffixed rate limit header for. */
const WINDOW_SUFFIXES = ['Second', 'Minute', 'Hour', 'Day', 'Month', 'Year'] as const;

export interface RateLimitWindowObservation {
  /** Lowercased window suffix, or `null` for the un-windowed draft headers. */
  unit: string | null;
  limit: number | null;
  remaining: number | null;
}

export interface RateLimitObservation {
  windows: RateLimitWindowObservation[];
  /** Seconds until the quota resets, from `RateLimit-Reset`. */
  resetSeconds: number | null;
  /** Seconds to wait, set by the gateway on 429 responses. */
  retryAfterSeconds: number | null;
  /** Response headers the observation was read from, for provenance disclosure. */
  headersUsed: string[];
}

function readHeader(headers: ResponseHeader[], name: string): number | null {
  const target = name.toLowerCase();
  // Last occurrence wins: duplicates are rare and the gateway appends its own headers.
  const header = headers.findLast(entry => entry.name.toLowerCase() === target);
  if (!header) {
    return null;
  }
  const value = Number.parseInt(header.value, 10);
  return Number.isFinite(value) ? value : null;
}

/**
 * Reads what the last response says about rate limiting. Everything comes from the
 * response headers Kong's rate limiting plugins add; nothing is inferred from the
 * plugin configuration, which only says what *should* happen.
 *
 * Kong writes one header set per request, so an observation is never attributed to
 * a single plugin instance.
 */
export function readRateLimitObservation(headers: ResponseHeader[]): RateLimitObservation | null {
  const headersUsed: string[] = [];
  const read = (name: string) => {
    const value = readHeader(headers, name);
    if (value !== null) {
      headersUsed.push(name);
    }
    return value;
  };

  const windows = WINDOW_SUFFIXES.flatMap(suffix => {
    const limit = read(`X-RateLimit-Limit-${suffix}`);
    const remaining = read(`X-RateLimit-Remaining-${suffix}`);
    return limit === null && remaining === null
      ? []
      : [{ unit: suffix.toLowerCase(), limit, remaining }];
  });

  // The draft headers name no window; only read them when no suffixed one matched.
  const draftLimit = windows.length === 0 ? read('RateLimit-Limit') : null;
  const draftRemaining = windows.length === 0 ? read('RateLimit-Remaining') : null;
  const resetSeconds = read('RateLimit-Reset');
  const retryAfterSeconds = read('Retry-After');

  if (windows.length > 0) {
    return { windows, resetSeconds, retryAfterSeconds, headersUsed };
  }
  if (draftLimit === null && draftRemaining === null) {
    // A throttled response can carry Retry-After without any quota headers.
    return retryAfterSeconds === null ? null : { windows: [], resetSeconds, retryAfterSeconds, headersUsed };
  }
  return {
    windows: [{ unit: null, limit: draftLimit, remaining: draftRemaining }],
    resetSeconds,
    retryAfterSeconds,
    headersUsed,
  };
}

/** `16 of 20 left this minute, 295 of 300 left this hour`. */
export function formatRateLimitObservation(observation: RateLimitObservation): string {
  const windows = observation.windows.map(window => {
    const count =
      window.remaining === null
        ? window.limit === null
          ? null
          : `${window.limit} allowed`
        : window.limit === null
          ? `${window.remaining} left`
          : `${window.remaining} of ${window.limit} left`;
    if (count === null) {
      return null;
    }
    return window.unit === null ? count : `${count} this ${window.unit}`;
  });
  const parts = windows.filter((part): part is string => part !== null);
  if (observation.resetSeconds !== null && observation.resetSeconds > 0) {
    // Relative to the response, not to now: the pane also shows responses loaded from history.
    parts.push(`reset ${observation.resetSeconds}s after this response`);
  }
  return parts.join(', ');
}
