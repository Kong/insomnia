// Redirect policy for the desktop request engine.
//
// libcurl replays every custom HTTPHEADER to each redirect target, including
// cross-origin hosts, with built-in protection only for Authorization and
// Cookie. Insomnia follows redirects by default, so a compromised or
// open-redirecting API could otherwise collect secret custom headers such as
// API keys. These pure helpers decide what each redirect hop may carry. They
// stay free of Electron and curl so they can be unit tested directly.

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

// Headers that are safe to forward when a redirect leaves the original origin.
// Everything else, credentials, cookies, API keys, custom tokens, host
// overrides, is dropped on cross-origin hops.
const CROSS_ORIGIN_SAFE_HEADERS = new Set(['accept', 'accept-language', 'accept-encoding']);

// Body descriptors only travel cross-origin when the hop preserves the body
// (307/308). A hop that downgrades to GET must not advertise a stale body.
const BODY_HEADER_NAMES = new Set(['content-type', 'content-length']);

export const isSameOrigin = (a: string, b: string): boolean => {
  try {
    const first = new URL(a);
    const second = new URL(b);
    return (
      first.protocol === second.protocol && first.hostname === second.hostname && first.port === second.port
    );
  } catch {
    // An unparseable URL never counts as same-origin. Fail closed.
    return false;
  }
};

// Resolve a Location value against the URL that issued the redirect. Returns
// null for missing, unparseable, or non-HTTP(S) targets. file:// and exotic
// schemes are never valid redirect targets for an HTTP client.
export const resolveRedirectUrl = (location: string | null, currentUrl: string): string | null => {
  if (!location) {
    return null;
  }
  try {
    const resolved = new URL(location, currentUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
};

export type RedirectDecision =
  | { action: 'follow'; url: string; method: string; dropBody: boolean }
  | { action: 'stop' }
  | { action: 'blocked'; location: string };

// Decide what to do with a 3xx response. Mirrors the redirect semantics
// libcurl applied internally before this file existed: follow 301/302/303 by
// downgrading everything except HEAD to GET, preserve method and body on
// 307/308, and stop when there is nowhere valid to go.
export const getRedirectDecision = ({
  statusCode,
  location,
  method,
  currentUrl,
}: {
  statusCode: number;
  location: string | null;
  method: string;
  currentUrl: string;
}): RedirectDecision => {
  if (!REDIRECT_STATUS_CODES.has(statusCode)) {
    return { action: 'stop' };
  }
  if (!location) {
    return { action: 'stop' };
  }
  const url = resolveRedirectUrl(location, currentUrl);
  if (!url) {
    return { action: 'blocked', location };
  }
  const upperMethod = method.toUpperCase();
  if (statusCode === 307 || statusCode === 308) {
    // Preserve the caller's method casing, as before.
    return { action: 'follow', url, method, dropBody: false };
  }
  if (upperMethod === 'HEAD') {
    return { action: 'follow', url, method, dropBody: true };
  }
  return { action: 'follow', url, method: 'GET', dropBody: true };
};

const headerNameOf = (header: string): string => {
  const colon = header.indexOf(':');
  const semi = header.indexOf(';');
  const end = colon === -1 ? semi : semi === -1 ? colon : Math.min(colon, semi);
  return (end === -1 ? header : header.slice(0, end)).trim().toLowerCase();
};

// Filter one hop's header strings. Same-origin hops pass through untouched.
// Cross-origin hops keep only headers with no credential value, plus body
// descriptors when the hop preserves the body. Returns the kept headers and
// the names that were dropped, in first-seen order, for timeline reporting.
export const filterHeadersForRedirect = (
  headerStrings: string[],
  { crossOrigin, preserveBody }: { crossOrigin: boolean; preserveBody: boolean },
): { headers: string[]; stripped: string[] } => {
  if (!crossOrigin) {
    return { headers: [...headerStrings], stripped: [] };
  }
  const headers: string[] = [];
  const stripped: string[] = [];
  const seen = new Set<string>();
  for (const header of headerStrings) {
    const name = headerNameOf(header);
    const keep =
      CROSS_ORIGIN_SAFE_HEADERS.has(name) || (preserveBody && BODY_HEADER_NAMES.has(name));
    if (keep) {
      headers.push(header);
      continue;
    }
    const rawName = header.trim().split(/[:;]/, 1)[0].trim();
    if (!seen.has(name)) {
      seen.add(name);
      stripped.push(rawName);
    }
  }
  return { headers, stripped };
};
