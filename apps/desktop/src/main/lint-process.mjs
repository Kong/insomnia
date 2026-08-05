/* eslint-disable no-undef */
console.log('[lint-process] Lint worker started');
import dns from 'node:dns/promises';
import fs from 'node:fs';
import { isIPv4, isIPv6 } from 'node:net';

import Spectral from '@stoplight/spectral-core';
import { Resolver } from '@stoplight/spectral-ref-resolver';
import { bundleAndLoadRuleset } from '@stoplight/spectral-ruleset-bundler/with-loader';
import { oas } from '@stoplight/spectral-rulesets';
import spectralRuntime from '@stoplight/spectral-runtime';

process.on('uncaughtException', error => {
  console.error(error);
});

function isPrivateOrLoopbackHost(hostname) {
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
    const groups = [...left, ...Array.from({ length: 8 - left.length - right.length }, () => '0'), ...right];
    const first = Number.parseInt(groups[0] || '0', 16);
    return (
      (groups.slice(0, 7).every(g => Number.parseInt(g, 16) === 0) && Number.parseInt(groups[7], 16) === 1) || // ::1 loopback
      (first & 0xfe_00) === 0xfc_00 || // fc00::/7 ULA
      (first & 0xff_c0) === 0xfe_80
    ); // fe80::/10 link-local
  }

  return false;
}

// Note: This is duplicated in inso's lint-specification.ts. Remember to mirror changes there as well.
function isSafeRefUrl(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') {
    return false;
  }
  return Boolean(url.hostname) && !isPrivateOrLoopbackHost(url.hostname.toLowerCase());
}

// Note: This is duplicated in inso's lint-specification.ts. Remember to mirror changes there as well.
async function assertResolvesToPublicHost(hostname) {
  const records = await dns.lookup(hostname, { all: true });
  for (const { address } of records) {
    if (isPrivateOrLoopbackHost(address)) {
      throw new Error(`Failed to resolve host. "${hostname}" resolves to a private or loopback address.`);
    }
  }
}

// Note: This is duplicated in inso's lint-specification.ts. Remember to mirror changes there as well.
const safeHttpResolver = {
  async resolve(ref) {
    const href = ref.href();
    if (!isSafeRefUrl(href)) {
      throw new Error(`Failed to fetch "${href}". Only https URLs to public hosts are allowed.`);
    }
    await assertResolvesToPublicHost(new URL(href).hostname.toLowerCase());
    const response = await fetch(href, { redirect: 'error', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      throw new Error(`Failed to fetch "${href}": ${response.status} ${response.statusText}`);
    }
    return response.text();
  },
};

// Note: This is duplicated in inso's lint-specification.ts. Remember to mirror changes there as well.
const safeRefResolver = new Resolver({
  resolvers: {
    http: safeHttpResolver,
    https: safeHttpResolver,
  },
});

process.parentPort.on('message', async ({ data: { documentContent, rulesetPath } }) => {
  let hasValidCustomRuleset = false;
  if (rulesetPath) {
    try {
      (await fs.promises.stat(rulesetPath)).isFile();
      hasValidCustomRuleset = true;
    } catch {}
  }
  try {
    const spectral = new Spectral.Spectral({ resolver: safeRefResolver });
    const { fetch } = spectralRuntime;
    const ruleset = hasValidCustomRuleset ? await bundleAndLoadRuleset(rulesetPath, { fs, fetch }) : oas;
    spectral.setRuleset(ruleset);
    console.log('[lint-process] Ruleset loaded:', rulesetPath || 'default OAS ruleset');
    const diagnostics = await spectral.run(documentContent);
    process.parentPort.postMessage({ diagnostics });
  } catch (err) {
    process.parentPort.postMessage({ error: err.message });
  }
});
