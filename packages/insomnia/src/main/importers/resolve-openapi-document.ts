import { bundle } from '@scalar/json-magic/bundle';
import { fetchUrls } from '@scalar/json-magic/bundle/plugins/browser';
import { dereference, validate } from '@scalar/openapi-parser';

import { fetchPublicHttps } from '../safe-fetch';

type OpenApiInput = Parameters<typeof validate>[0];

/**
 * Bundles remote `$ref`s, then validates and dereferences an OpenAPI / Swagger document.
 * Remote `$ref`s are fetched with the SSRF policy of `fetchPublicHttps` (https only, public hosts only
 * - also at connection time -, no redirects, with a timeout); a `$ref` that cannot be fetched is left as is.
 * Validation and reference errors are only logged: the document is always dereferenced as far as possible,
 * so one unresolvable reference or a structural error does not leave every other `$ref` unresolved.
 *
 * Note: bundling resolves remote `$ref`s into the passed document in place.
 */
export const resolveOpenApiDocument = async <T>(document: T, logPrefix: string): Promise<T> => {
  try {
    const bundled = await bundle(document as Record<string, unknown>, {
      // `fetchUrls` turns any fetch failure into an unresolved reference instead of aborting the bundle.
      // Only the URL is forwarded: the plugin's 2nd argument (request init) must not reach the safe fetch.
      plugins: [fetchUrls({ fetch: href => fetchPublicHttps(String(href)) as unknown as Promise<Response> })],
      treeShake: true,
    });

    const { valid, errors: validationErrors } = await validate(bundled as OpenApiInput);
    if (!valid) {
      console.log(`${logPrefix} Import file validation failed`, validationErrors);
    }

    const { schema, errors: dereferenceErrors } = await dereference(bundled as OpenApiInput);
    if (dereferenceErrors?.length) {
      console.log(`${logPrefix} Failed to resolve references`, dereferenceErrors);
    }
    if (schema) {
      // Bundled remote documents live in `x-ext`; they are inlined by now.
      delete (schema as Record<string, unknown>)['x-ext'];
      return schema as T;
    }
    return document;
  } catch (err) {
    console.log(`${logPrefix} Failed to resolve the document`, err);
    return document;
  }
};
