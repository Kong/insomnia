/* eslint-disable no-undef */
console.log('[lint-process] Lint worker started');
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

const safeHttpResolver = {
  async resolve(ref) {
    const href = ref.href();
    if (!isSafeRefUrl(href)) {
      throw new Error(`Refused to resolve $ref "${href}" — only https URLs to public hosts are allowed.`);
    }
    const response = await fetch(href);
    if (!response.ok) {
      throw new Error(`Failed to fetch $ref "${href}": ${response.status} ${response.statusText}`);
    }
    return response.text();
  },
};

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
