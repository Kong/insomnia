import { Resolver } from '@stoplight/spectral-ref-resolver';

import { isPrivateOrLoopbackHost } from './spectral-ruleset-validator';

function isSafeRefUrl(href: string): boolean {
  let url: URL;
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
  async resolve(ref: { href: () => string }): Promise<string> {
    const href = ref.href();
    if (!isSafeRefUrl(href)) {
      throw new Error(`Refused to resolve $ref "${href}" — only https URLs to public unicast hosts are allowed.`);
    }
    const response = await fetch(href);
    if (!response.ok) {
      throw new Error(`Failed to fetch $ref "${href}": ${response.status} ${response.statusText}`);
    }
    return response.text();
  },
};

export const safeRefResolver = new Resolver({
  resolvers: {
    http: safeHttpResolver,
    https: safeHttpResolver,
  },
});
