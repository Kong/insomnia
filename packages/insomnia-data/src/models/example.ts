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
 * It evolves independently from the parent Request afterwards (see ADR 0001).
 */
export const baseExampleRequestSchema = baseRequestSchema.pick({
  method: true,
  url: true,
  parameters: true,
  pathParameters: true,
  headers: true,
  body: true,
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
export const exampleSummarySchema = schema.pick({
  _id: true,
  parentId: true,
  type: true,
  name: true,
  description: true,
  metaSortKey: true,
  modified: true,
  created: true,
  isPrivate: true,
}).extend({
  request: baseExampleRequestSchema.pick({ method: true }),
  response: baseExampleResponseSchema.pick({ statusCode: true }),
});
export type ExampleSummary = z.infer<typeof exampleSummarySchema>;

/**
 * Merge the summary-visible fields of a patch (the sidebar needs the name, sort
 * key, method and status code) without touching the fields it does not carry.
 */
export const applyExampleSummaryPatch = (summary: ExampleSummary, patch: ExamplePatch): ExampleSummary => {
  const parsed = examplePatchSchema.parse(patch);
  return {
    ...summary,
    ...(parsed.name !== undefined ? { name: parsed.name } : {}),
    ...(parsed.description !== undefined ? { description: parsed.description } : {}),
    ...(parsed.metaSortKey !== undefined ? { metaSortKey: parsed.metaSortKey } : {}),
    ...(parsed.request?.method !== undefined
      ? { request: { ...summary.request, method: parsed.request.method } }
      : {}),
    ...(parsed.response?.statusCode !== undefined
      ? { response: { ...summary.response, statusCode: parsed.response.statusCode } }
      : {}),
  };
};

export const toExampleSummary = (example: Example): ExampleSummary => ({
  _id: example._id,
  parentId: example.parentId,
  type: 'Example',
  name: example.name,
  description: example.description,
  metaSortKey: example.metaSortKey,
  modified: example.modified,
  created: example.created,
  isPrivate: example.isPrivate,
  request: { method: example.request.method },
  response: { statusCode: example.response.statusCode },
});

export function init(): BaseExample {
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
  };
}

export const isExample = (model: Pick<BaseModel, 'type'>): model is Example => model.type === type;

export const isExampleId = (id?: string | null) => id?.startsWith(`${prefix}_`);

/**
 * Whether a request may own examples. An Example is a request/response pair, so
 * only plain HTTP requests qualify: GraphQL and event streams resolve through
 * websocket/streaming protocols whose result is not a single response.
 * Locally stored examples under other requests are not deleted, but they are
 * never exported and cannot be created or tried.
 */
export const canHostExamples = (request: {
  body?: { mimeType?: string | null };
  headers?: { name: string; value: string }[];
}): boolean =>
  request.body?.mimeType !== CONTENT_TYPE_GRAPHQL &&
  // Header names and media types are case-insensitive, and `Accept` may list
  // several types or carry parameters — match the media type, not a literal.
  !request.headers?.some(
    header =>
      header.name.toLowerCase() === 'accept' && header.value.toLowerCase().includes('text/event-stream'),
  );

/**
 * Response headers that must never be stored in an example: `set-cookie` is
 * session state that Try it would otherwise replay, and `content-length` is
 * derived from the body. Shared by the save-as-example and Postman import
 * paths.
 */
export const EXAMPLE_RESPONSE_HEADER_DENYLIST = ['content-length', 'set-cookie'];

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

/**
 * Shallow-merge a validated client patch onto an Example snapshot, so
 * incremental updates (`{ request: { url } }`) never clobber sibling keys with
 * values from a stale client-side copy.
 */
export function applyExamplePatch(example: Example, patch: ExamplePatch): Partial<Example> {
  const { request, response, ...topLevel } = examplePatchSchema.parse(patch);
  const merged: Partial<Example> = { ...topLevel };
  if (request) {
    merged.request = { ...example.request, ...request };
  }
  if (response) {
    merged.response = { ...example.response, ...response };
  }
  return merged;
}

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
