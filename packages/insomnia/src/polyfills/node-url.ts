/**
 * Minimal polyfill for Node.js's legacy `url` module.
 * Used in the renderer (nodeIntegration: false) so packages like httpsnippet
 * that call url.parse() don't crash at runtime.
 */

export interface Url {
  href?: string;
  protocol?: string;
  auth?: string;
  host?: string;
  port?: string;
  hostname?: string;
  hash?: string;
  search?: string;
  query?: string | Record<string, string>;
  pathname?: string;
  path?: string;
  slashes?: boolean;
}

export function parse(urlString: string, parseQueryString = false): Url {
  try {
    const u = new URL(urlString);
    const query: string | Record<string, string> = parseQueryString
      ? Object.fromEntries(u.searchParams.entries())
      : (u.search ? u.search.slice(1) : '');
    return {
      href: u.href,
      protocol: u.protocol,
      slashes: true,
      auth: u.username ? `${u.username}${u.password ? ':' + u.password : ''}` : undefined,
      host: u.host,
      port: u.port || undefined,
      hostname: u.hostname,
      hash: u.hash || undefined,
      search: u.search || undefined,
      query,
      pathname: u.pathname,
      path: u.pathname + (u.search || ''),
    };
  } catch {
    return { href: urlString };
  }
}

export function format(urlObject: Url): string {
  if (typeof urlObject === 'string') {
    return urlObject;
  }
  const { protocol, host, hostname, port, pathname, search, hash, auth } = urlObject;
  let result = '';
  if (protocol) {
    result += protocol + (urlObject.slashes !== false ? '//' : '');
  }
  if (auth) {
    result += auth + '@';
  }
  if (host) {
    result += host;
  } else if (hostname) {
    result += hostname + (port ? ':' + port : '');
  }
  result += pathname || '/';
  if (search) {
    result += search;
  }
  if (hash) {
    result += hash;
  }
  return result;
}

export function resolve(from: string, to: string): string {
  return new URL(to, from).href;
}

export default { parse, format, resolve };
