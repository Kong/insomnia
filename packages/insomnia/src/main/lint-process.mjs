/* eslint-disable no-undef */
console.log('[lint-process] Lint worker started');
import dns from 'node:dns/promises';
import fs from 'node:fs';

import Spectral from '@stoplight/spectral-core';
import { Resolver } from '@stoplight/spectral-ref-resolver';
import { bundleAndLoadRuleset } from '@stoplight/spectral-ruleset-bundler/with-loader';
import { oas } from '@stoplight/spectral-rulesets';
import spectralRuntime from '@stoplight/spectral-runtime';
import ipaddr from 'ipaddr.js';

process.on('uncaughtException', error => {
  console.error(error);
});

// Note: This is duplicated in inso's lint-specification.ts. Remember to mirror changes there as well.
function isPrivateOrLoopbackHost(hostname) {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return true;
  }
  const host = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  if (!ipaddr.isValid(host)) {
    return false;
  }
  return ipaddr.process(host).range() !== 'unicast';
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
    const response = await fetch(href, { redirect: 'error' });
    if (!response.ok) {
      throw new Error(`Failed to fetch "${href}": ${response.status} ${response.statusText}`);
    }
    return response.text();
  },
};

// Note: This is duplicated in inso's lint-specification.ts. Remember to mirror changes there as well.
const safeResolver = new Resolver({
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
    const spectral = new Spectral.Spectral({ resolver: safeResolver });
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
