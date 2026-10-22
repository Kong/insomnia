import type { IQueryStringOptions } from 'insomnia-data/common';

import { CONFIDENTIAL_MASK_VALUE } from '~/common/templating/confidential-value-policy';

import { smartEncodeUrl } from './querystring';

// The confidential mask (••••••) is non-ASCII, so URL encoding would mangle it: punycode in the
// host (xn--nvgaaaaa) and percent-encoding elsewhere. Surfaces that show a masked URL (URL preview,
// HAR export, code snippets) swap it for a lowercase ASCII placeholder (hostnames get lowercased)
// before building/encoding the URL, and restore it afterwards.
// The random suffix keeps restoreMask from turning user text that happens to match into bullets.
export const MASK_PLACEHOLDER = `confidentialmask${crypto.randomUUID().replaceAll('-', '')}`;

export const protectMask = (value: string) => value.replaceAll(CONFIDENTIAL_MASK_VALUE, MASK_PLACEHOLDER);
export const restoreMask = (value: string) => value.replaceAll(MASK_PLACEHOLDER, CONFIDENTIAL_MASK_VALUE);

// Swaps the mask in every string leaf of a plain object/array, preserving shape.
export const protectMaskDeep = <T>(value: T): T => {
  if (typeof value === 'string') {
    return protectMask(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map(protectMaskDeep) as T;
  }
  if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, protectMaskDeep(v)])) as T;
  }
  return value;
};

// When the URL starts with the mask, the confidential value may already carry its own scheme
// (e.g. a `{{ _.baseUrl }}` of `https://api.example.com`). smartEncodeUrl would then see no scheme
// and prepend `http://`, showing `http://••••••` for a URL that is really `https://...`. Encode with
// a temporary scheme and drop it again, so the URL starts with just the mask.
const TEMPORARY_SCHEME = 'http://';

// Encodes a URL whose mask has already been swapped for the placeholder; the result still holds it.
export const encodeProtectedUrl = (url: string, encode?: boolean, options?: IQueryStringOptions) => {
  if (!url.startsWith(MASK_PLACEHOLDER)) {
    return smartEncodeUrl(url, encode, options);
  }
  const encoded = smartEncodeUrl(`${TEMPORARY_SCHEME}${url}`, encode, options);
  return encoded.startsWith(TEMPORARY_SCHEME) ? encoded.slice(TEMPORARY_SCHEME.length) : encoded;
};

// smartEncodeUrl for a URL that may contain the mask, keeping the mask intact.
export const encodeUrlKeepingMask = (url: string, encode?: boolean, options?: IQueryStringOptions) =>
  restoreMask(encodeProtectedUrl(protectMask(url), encode, options));

// Code generators (httpsnippet) parse and re-encode the HAR request URL and query string on their
// own, so the mask has to stay swapped out until the snippet text is produced. A URL starting with
// the mask gets the same temporary scheme as above, removed again from the generated text.
export const convertHarRequestKeepingMask = <T extends { url: string }>(
  harRequest: T,
  convert: (harRequest: T) => string,
) => {
  const protectedRequest = protectMaskDeep(harRequest);
  if (!protectedRequest.url.startsWith(MASK_PLACEHOLDER)) {
    return restoreMask(convert(protectedRequest));
  }
  const output = convert({ ...protectedRequest, url: `${TEMPORARY_SCHEME}${protectedRequest.url}` });
  return restoreMask(output.replaceAll(`${TEMPORARY_SCHEME}${MASK_PLACEHOLDER}`, MASK_PLACEHOLDER));
};
