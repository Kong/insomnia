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
