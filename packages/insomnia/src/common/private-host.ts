import dns from 'node:dns/promises';
import { isIPv4, isIPv6 } from 'node:net';

// ** For main process only. Do not import this file into the renderer **
// Classifies a hostname or IP literal as private/loopback. Used as an SSRF guard when deciding
// whether a remote URL is safe to fetch. This is a synchronous check on the literal value only;
// callers that must also defend against DNS rebinding resolve the host and re-check the resulting
// addresses with this same function (see common/bundle-spectral-ruleset.ts).
// Note: duplicated in the Spectral lint worker (main/lint-process.mjs), which is a plain .mjs
// module and cannot import this file. If this logic changes, mirror it there.
export function isPrivateOrLoopbackHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
  const host = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

  if (isIPv4(host)) {
    const [a, b] = host.split('.').map(Number);
    return (
      a === 0 || // 0.0.0.0/8    unspecified (routes to localhost on most platforms)
      a === 127 || // 127.0.0.0/8  loopback
      a === 10 || // 10.0.0.0/8   private
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 private
      (a === 192 && b === 168) || // 192.168.0.0/16 private
      (a === 169 && b === 254)
    ); // 169.254.0.0/16 link-local
  }

  if (isIPv6(host)) {
    // Expand :: notation to 8 groups so we can bit-mask the first group
    const halves = host.split('::');
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    const groups = [...left, ...Array.from<string>({ length: 8 - left.length - right.length }).fill('0'), ...right];
    const first = Number.parseInt(groups[0] || '0', 16);
    return (
      (groups.slice(0, 7).every(g => Number.parseInt(g, 16) === 0) && Number.parseInt(groups[7], 16) === 1) || // ::1 loopback
      (first & 0xfe_00) === 0xfc_00 || // fc00::/7 ULA
      (first & 0xff_c0) === 0xfe_80
    ); // fe80::/10 link-local
  }

  return false;
}

// ** For main process only. Do not import this file into the renderer **
// Narrower SSRF guard than isPrivateOrLoopbackHost: classifies a hostname or IP literal as
// loopback/localhost ONLY. Private LAN ranges (10/8, 172.16/12, 192.168/16), link-local
// (169.254 / fe80::/10) and ULA (fc00::/7) are intentionally treated as safe, because a company
// may legitimately host an internal npm registry or repo on a private address. Used to stop
// plugin installs from reaching the user's own machine while still allowing intranet registries.
export function isLoopbackHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
  const host = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

  if (isIPv4(host)) {
    const [a] = host.split('.').map(Number);
    return (
      a === 0 || // 0.0.0.0/8    unspecified (routes to localhost on most platforms)
      a === 127
    ); // 127.0.0.0/8  loopback
  }

  if (isIPv6(host)) {
    // Expand :: notation to 8 groups so we can check for ::1
    const halves = host.split('::');
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    const groups = [...left, ...Array.from<string>({ length: 8 - left.length - right.length }).fill('0'), ...right];
    return groups.slice(0, 7).every(g => Number.parseInt(g, 16) === 0) && Number.parseInt(groups[7], 16) === 1; // ::1 loopback
  }

  return false;
}

// Parses a URL and rejects it if it targets loopback/localhost, either directly or after DNS
// resolution (defends against rebinding tricks such as *.localtest.me -> 127.0.0.1). The protocol
// is intentionally NOT restricted to https, since an internal company registry may serve over http
// on a private address. Returns the parsed URL on success. Main process only.
export async function assertNotLoopbackUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  const hostname = url.hostname.toLowerCase();
  if (!hostname || isLoopbackHost(hostname)) {
    throw new Error(`URL targets a disallowed loopback host: ${url.href}`);
  }
  const records = await dns.lookup(hostname, { all: true });
  for (const { address } of records) {
    if (isLoopbackHost(address.toLowerCase())) {
      throw new Error(`Host "${url.href}" resolves to a loopback address.`);
    }
  }
  return url;
}
