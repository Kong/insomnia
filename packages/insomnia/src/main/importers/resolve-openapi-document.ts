import dns from 'node:dns/promises';

import { dereference, load, validate } from '@scalar/openapi-parser';
import { fetchUrls } from '@scalar/openapi-parser/plugins/fetch-urls';

import { isPrivateOrLoopbackHost } from '../private-host';

const REMOTE_REF_TIMEOUT_MS = 10_000;

/**
 * Fetches a remote `$ref` with the same SSRF policy as Spectral linting (main/lint-process.mjs):
 * https only, public hosts only (also after DNS resolution), no redirects, with a timeout.
 */
export const fetchRemoteRef = async (href: string): Promise<Response> => {
  const url = new URL(href);
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || !hostname || isPrivateOrLoopbackHost(hostname)) {
    throw new Error(`Failed to fetch "${href}". Only https URLs to public hosts are allowed.`);
  }
  const records = await dns.lookup(hostname, { all: true });
  if (records.some(({ address }) => isPrivateOrLoopbackHost(address.toLowerCase()))) {
    throw new Error(`Failed to fetch "${href}". The host resolves to a private or loopback address.`);
  }
  const response = await fetch(href, { redirect: 'error', signal: AbortSignal.timeout(REMOTE_REF_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`Failed to fetch "${href}": ${response.status} ${response.statusText}`);
  }
  return response;
};

/**
 * Loads remote `$ref`s, validates and dereferences an OpenAPI / Swagger document.
 * Validation and reference errors are only logged: the document is always dereferenced as far as possible,
 * so one unresolvable reference or a structural error does not leave every other `$ref` unresolved.
 */
export const resolveOpenApiDocument = async <T>(document: T, logPrefix: string): Promise<T> => {
  try {
    const { filesystem, errors: loadErrors } = await load(document as Record<string, unknown>, {
      plugins: [fetchUrls({ fetch: fetchRemoteRef })],
    });
    if (loadErrors?.length) {
      console.log(`${logPrefix} Failed to load external references`, loadErrors);
    }

    const { valid, errors: validationErrors } = await validate(filesystem);
    if (!valid) {
      console.log(`${logPrefix} Import file validation failed`, validationErrors);
    }

    const { schema, errors: dereferenceErrors } = await dereference(filesystem);
    if (dereferenceErrors?.length) {
      console.log(`${logPrefix} Failed to resolve references`, dereferenceErrors);
    }
    return (schema ?? document) as T;
  } catch (err) {
    console.log(`${logPrefix} Failed to resolve the document`, err);
    return document;
  }
};
