import type { LookupAddress } from 'node:dns';
import dns from 'node:dns/promises';

import { Agent, fetch as undiciFetch } from 'undici';

import { isPrivateOrLoopbackHost } from './private-host';

// ** For main process only. Do not import this file into the renderer **
// SSRF-safe fetch for user-controlled URLs (e.g. remote `$ref`s in imported documents).
// - https only, no literal private/loopback hosts, no redirects, with a timeout.
// - The resolved addresses are validated in the socket's `lookup` callback, i.e. for the very
//   lookup the connection is made with. Checking with a separate `dns.lookup()` before `fetch()`
//   would let a DNS-rebinding host answer with a public IP for the check and a private IP for the connection.
//   TLS hostname verification still runs against the original hostname.
//
// TODO: Migrate the other SSRF-guarded remote fetches to this module so the policy lives in one place.
// They still use the "dns.lookup() check, then fetch()" pattern, which is open to DNS rebinding:
// - main/bundle-spectral-ruleset.ts (`assertSafeRemoteUrl` + `readRemoteRuleset`)
// - main/lint-process.mjs (`safeHttpResolver`) - a plain .mjs worker that cannot import this file as is
// - packages/insomnia-inso/src/commands/lint-specification.ts (separate package)

const DEFAULT_TIMEOUT_MS = 10_000;

type LookupCallback = (err: Error | null, address?: string | LookupAddress[], family?: number) => void;

export const validatedLookup = async (
  hostname: string,
  options: { all?: boolean },
  callback: LookupCallback,
): Promise<void> => {
  try {
    const records = await dns.lookup(hostname, { all: true });
    if (records.length === 0 || records.some(({ address }) => isPrivateOrLoopbackHost(address.toLowerCase()))) {
      callback(new Error(`The host "${hostname}" resolves to a private or loopback address.`));
      return;
    }
    if (options.all) {
      callback(null, records);
    } else {
      callback(null, records[0].address, records[0].family);
    }
  } catch (err) {
    callback(err as Error);
  }
};

// Every new connection goes through `validatedLookup`, so a shared agent is safe to reuse.
const publicHostAgent = new Agent({ connect: { lookup: validatedLookup as never } });

export const fetchPublicHttps = async (href: string, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const url = new URL(href);
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || !hostname || isPrivateOrLoopbackHost(hostname)) {
    throw new Error(`Failed to fetch "${href}". Only https URLs to public hosts are allowed.`);
  }
  return undiciFetch(url, { dispatcher: publicHostAgent, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
};
