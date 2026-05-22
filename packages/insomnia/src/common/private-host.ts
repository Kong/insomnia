import ipaddr from 'ipaddr.js';

// Classifies a hostname or IP literal as private/loopback. Used as an SSRF guard when deciding
// whether a remote URL is safe to fetch. This is a synchronous check on the literal value only;
// callers that must also defend against DNS rebinding resolve the host and re-check the resulting
// addresses with this same function (see common/bundle-spectral-ruleset.ts).
// Note: duplicated in the Spectral lint worker (main/lint-process.mjs), which is a plain .mjs
// module and cannot import this file. If this logic changes, mirror it there.
export function isPrivateOrLoopbackHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return true;
  }
  const host = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  if (!ipaddr.isValid(host)) {
    return false;
  }
  return ipaddr.process(host).range() !== 'unicast';
}
