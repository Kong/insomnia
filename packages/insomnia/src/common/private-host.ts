import dns from 'node:dns/promises';
import { isIPv4, isIPv6 } from 'node:net';

// Pure synchronous checks — safe in both main and renderer.
// assertNotLoopbackUrl does DNS resolution and is main process only.
// Mirrored in main/lint-process.mjs — keep in sync.

export function isPrivateOrLoopbackHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
  const host = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

  if (isIPv4(host)) {
    const [a, b] = host.split('.').map(Number);
    return (
      a === 0 ||                              // 0.0.0.0/8    unspecified
      a === 127 ||                            // 127.0.0.0/8  loopback
      a === 10 ||                             // 10.0.0.0/8   private
      (a === 172 && b >= 16 && b <= 31) ||    // 172.16.0.0/12 private
      (a === 192 && b === 168) ||             // 192.168.0.0/16 private
      (a === 169 && b === 254)                // 169.254.0.0/16 link-local
    );
  }

  if (isIPv6(host)) {
    const halves = host.split('::');
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    const groups = [...left, ...Array.from<string>({ length: 8 - left.length - right.length }).fill('0'), ...right];
    const first = Number.parseInt(groups[0] || '0', 16);
    return (
      (groups.slice(0, 7).every(g => Number.parseInt(g, 16) === 0) && Number.parseInt(groups[7], 16) === 1) || // ::1
      (first & 0xfe_00) === 0xfc_00 ||        // fc00::/7 ULA
      (first & 0xff_c0) === 0xfe_80           // fe80::/10 link-local
    );
  }

  return false;
}

// Loopback only — private LAN ranges are allowed (intranet registries).
export function isLoopbackHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
  const host = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

  if (isIPv4(host)) {
    const [a] = host.split('.').map(Number);
    return a === 0 || a === 127;
  }

  if (isIPv6(host)) {
    const halves = host.split('::');
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    const groups = [...left, ...Array.from<string>({ length: 8 - left.length - right.length }).fill('0'), ...right];
    return groups.slice(0, 7).every(g => Number.parseInt(g, 16) === 0) && Number.parseInt(groups[7], 16) === 1;
  }

  return false;
}

// Rejects private/loopback targets, directly or via DNS (guards against rebinding). Main process only.
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
