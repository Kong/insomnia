import { CONTENT_TYPE_GRAPHQL, METHOD_GET } from 'insomnia-data/common';
import { z } from 'zod/v4';

import { type BaseModel, createModelSchema } from './base-types';
import { baseRequestSchema } from './request';
import { replaceIdsInFields } from './utils/replace-ids-in-fields';

export const name = 'Example';

export const type = 'Example';

export const prefix = 'exp';

export const canDuplicate = true;

export const canSync = true;

const exampleResponseHeaderSchema = z.object({
  name: z.string(),
  value: z.string(),
});

/**
 * A snapshot of the parent Request, taken when the Example is created.
 * It evolves independently from the parent Request afterwards.
 */
export const baseExampleRequestSchema = baseRequestSchema.pick({
  method: true,
  url: true,
  parameters: true,
  pathParameters: true,
  headers: true,
  body: true,
  disableUserAgentHeader: true,
});
export type ExampleRequest = z.infer<typeof baseExampleRequestSchema>;

export const baseExampleResponseSchema = z.object({
  statusCode: z.number().optional().default(200),
  statusMessage: z.string().optional().default(''),
  headers: z.array(exampleResponseHeaderSchema).optional().default([]),
  body: z.string().optional().default(''),
});
export type ExampleResponse = z.infer<typeof baseExampleResponseSchema>;

export const baseExampleSchema = z.object({
  name: z.string().optional().default(''),
  description: z.string().optional().default(''),
  request: baseExampleRequestSchema,
  response: baseExampleResponseSchema,
  metaSortKey: z.number(),
});
export type BaseExample = z.infer<typeof baseExampleSchema>;

export const schema = createModelSchema(type, prefix).extend(baseExampleSchema.shape);
export type Example = z.infer<typeof schema>;

/**
 * What lists need to render an example: identity, sorting and the two badge
 * values. Request/response bodies are deliberately absent so workspace-wide
 * payloads (sidebar, workspace switcher) never carry example bodies.
 */
export const exampleSummarySchema = schema.omit({ request: true, response: true }).extend({
  request: baseExampleRequestSchema.pick({ method: true }),
  response: baseExampleResponseSchema.pick({ statusCode: true }),
});
export type ExampleSummary = z.infer<typeof exampleSummarySchema>;

/**
 * `exampleSummarySchema` as a database projection, so a workspace-wide read never
 * loads an example body (up to 1 MB each). Derived from the schema so the two
 * cannot drift.
 */
const toProjection = (shape: z.ZodRawShape, prefix = ''): Record<string, 1> =>
  Object.fromEntries(
    Object.entries(shape).flatMap(([key, field]) =>
      field instanceof z.ZodObject
        ? Object.entries(toProjection(field.shape as z.ZodRawShape, `${prefix}${key}.`))
        : [[`${prefix}${key}`, 1]],
    ),
  );

export const exampleSummaryProjection = toProjection(exampleSummarySchema.shape);

/**
 * Hard limit on a stored example response body. An example travels with the
 * collection — NeDB datafile, git history, cloud snapshots — and NeDB appends
 * the whole document on every write, so an unbounded body multiplies the cost
 * of every edit. Writes the app performs are rejected above the limit, never
 * truncated; a document that arrives from a file, an older client or the generic
 * git/cloud write paths can still exceed it, and then the editor refuses to save
 * until the body is back under the limit.
 *
 * Only the response body is capped: the request snapshot is a copy of the parent
 * request, which already lives in the collection.
 */
export const MAX_EXAMPLE_RESPONSE_BODY_BYTES = 1024 * 1024;

const utf8ByteLength = (value: string) => new TextEncoder().encode(value).length;

export const isExampleResponseBodyWithinLimit = (body: string | undefined) =>
  !body || utf8ByteLength(body) <= MAX_EXAMPLE_RESPONSE_BODY_BYTES;

export const assertExampleResponseBodySize = (body: string | undefined) => {
  const bytes = body ? utf8ByteLength(body) : 0;
  if (bytes > MAX_EXAMPLE_RESPONSE_BODY_BYTES) {
    throw new Error(
      `Example response body is ${(bytes / 1024 / 1024).toFixed(1)} MB; the limit is ${
        MAX_EXAMPLE_RESPONSE_BODY_BYTES / 1024 / 1024
      } MB`,
    );
  }
};

export function init(): BaseExample & Pick<BaseModel, 'isPrivate'> {
  return {
    name: '',
    description: '',
    request: {
      method: METHOD_GET,
      url: '',
      parameters: [],
      pathParameters: undefined,
      headers: [],
      body: {},
    },
    response: {
      statusCode: 200,
      statusMessage: '',
      headers: [],
      body: '',
    },
    metaSortKey: -1 * Date.now(),
    // Must be declared here: `initModel` prunes keys the model's `init()` does
    // not return, which silently dropped the flag (and with it `canSync`'s
    // private check) for every example.
    isPrivate: false,
  };
}

export const isExample = (model: Pick<BaseModel, 'type'>): model is Example => model.type === type;

/**
 * Whether a request may own examples. An Example is a request/response pair, so
 * only plain HTTP requests qualify: GraphQL and event streams resolve through
 * websocket/streaming protocols whose result is not a single response.
 *
 * This gates creation only. Examples already stored under such a request are
 * kept — exported with the collection so a file roundtrip does not delete them
 * — but they are hidden from lists and left out of cloud snapshots.
 */
export const canHostExamples = (request: {
  body?: { mimeType?: string | null };
  headers?: { name: string; value: string; disabled?: boolean }[];
}): boolean =>
  request.body?.mimeType !== CONTENT_TYPE_GRAPHQL &&
  // Header names and media types are case-insensitive, `Accept` may list several
  // types or carry parameters, and a disabled header is not sent at all — match
  // the media type of the headers that are.
  !request.headers?.some(
    header =>
      !header.disabled &&
      header.name.toLowerCase() === 'accept' &&
      header.value.toLowerCase().includes('text/event-stream'),
  );

/**
 * A patch accepts any subset of a snapshot. Defaults are dropped while mapping
 * the shape: an absent key must stay absent, otherwise merging one field would
 * overwrite its siblings with default values (a `{ url }` patch would reset the
 * method).
 */
const toPatchShape = <T extends z.ZodRawShape>(shape: T) =>
  Object.fromEntries(
    Object.entries(shape).map(([key, field]) => [
      key,
      z.optional(field instanceof z.ZodDefault ? field.unwrap() : field),
    ]),
  ) as { [K in keyof T]: z.ZodOptional<T[K]> };

/**
 * Client-supplied patch for an Example. Unknown keys are stripped and values
 * are validated by the snapshot schemas, so identity fields (`_id`, `parentId`,
 * …) never reach the database and `statusCode: NaN` is rejected.
 */
export const examplePatchSchema = z.object({
  ...toPatchShape(baseExampleSchema.shape),
  request: z.object(toPatchShape(baseExampleRequestSchema.shape)).optional(),
  response: z.object(toPatchShape(baseExampleResponseSchema.shape)).optional(),
});
export type ExamplePatch = z.input<typeof examplePatchSchema>;

export function rewriteReferences(example: Example, idMapping: Map<string, string>): Example {
  return {
    ...example,
    request: {
      ...example.request,
      ...replaceIdsInFields(
        example.request,
        [
          'url',
          'body',
          'parameters',
          'pathParameters',
          'headers',
        ],
        idMapping,
      ),
    },
  };
}
