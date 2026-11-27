import type { Example, ExamplePatch, ExampleRequest, ExampleResponse, Query, Request } from 'insomnia-data';
import { database as db, models } from 'insomnia-data';
import { getMetaSortKeyAfter } from 'insomnia-data/common';

const { type } = models.example;

function list(query?: Query<Example>, sort?: Record<string, any>, limit?: number) {
  return db.find<Example>(type, query, sort, limit);
}

function get(query?: Query<Example>, sort?: Record<string, any>) {
  return db.findOne<Example>(type, query, sort);
}

export function getById(id: string) {
  return get({ _id: id });
}

export function listByParentIds(parentIds: string | string[]) {
  return list({ parentId: { $in: Array.isArray(parentIds) ? parentIds : [parentIds] } });
}

type ExampleCreatePatch = Partial<Omit<Example, 'request' | 'response'>> & {
  // Complete snapshots only: `initModel` replaces nested objects wholesale, so a
  // partial one would drop the field defaults the editors and the export read.
  request?: ExampleRequest;
  response?: ExampleResponse;
};

export async function create(patch: ExampleCreatePatch = {}) {
  if (!patch.parentId) {
    throw new Error('New Example missing `parentId`: ' + JSON.stringify(patch));
  }
  const parentRequest = await db.findOne<Request>(models.request.type, { _id: patch.parentId });
  if (!parentRequest) {
    throw new Error(`Parent request not found: ${patch.parentId}`);
  }
  if (!models.example.canHostExamples(parentRequest)) {
    throw new Error('Examples are only supported for plain HTTP requests');
  }
  models.example.assertExampleResponseBodySize(patch.response?.body);
  return db.docCreate<Example>(type, patch);
}

interface CreateExampleFromRequestPayload {
  name: string;
  // Overrides for the fields snapshotted from the parent request
  request?: Partial<ExampleRequest>;
  response?: Partial<ExampleResponse>;
}

/**
 * Snapshot an HTTP request as an example. The parent must exist and be a plain
 * HTTP request: a gRPC/WebSocket sibling, or a GraphQL/event-stream request, has
 * no single response to snapshot.
 */
export async function createFromRequest(requestId: string, payload: CreateExampleFromRequestPayload) {
  const parentRequest = await db.findOne<Request>(models.request.type, { _id: requestId });
  if (!parentRequest) {
    throw new Error('Request not found');
  }
  if (!models.example.canHostExamples(parentRequest)) {
    throw new Error('Examples are only supported for plain HTTP requests');
  }
  const { method, url, parameters, pathParameters, headers, body, disableUserAgentHeader } = parentRequest;
  const { response: defaultResponse } = models.example.init();

  return create({
    parentId: requestId,
    name: payload.name,
    isPrivate: parentRequest.isPrivate,
    request: { method, url, parameters, pathParameters, headers, body, disableUserAgentHeader, ...payload.request },
    response: { ...defaultResponse, ...payload.response },
  });
}

/**
 * Incremental update: parse the client patch (unknown keys stripped, snapshot
 * fields validated), merge it onto the stored snapshots, and refuse a response
 * body over the size limit. Throws on an unknown id or an invalid patch.
 */
export async function update(exampleOrId: Example | string, patch: ExamplePatch) {
  const example = await getById(typeof exampleOrId === 'string' ? exampleOrId : exampleOrId._id);
  if (!example) {
    throw new Error(`Example not found: ${exampleOrId}`);
  }
  const { request, response, ...topLevel } = models.example.examplePatchSchema.parse(patch);
  const changes: Partial<Example> = {
    ...topLevel,
    ...(request ? { request: { ...example.request, ...request } } : {}),
    ...(response ? { response: { ...example.response, ...response } } : {}),
  };
  if (Object.keys(changes).length === 0) {
    return example;
  }
  // Only a body edit can exceed the limit; measuring on every patch would encode
  // the whole (up to 1 MB) body even for a rename or a sort-key move.
  if (response?.body !== undefined) {
    models.example.assertExampleResponseBodySize(response.body);
  }
  return db.docUpdate<Example>(example, changes);
}

export async function remove(exampleOrId: Example | string) {
  const example = await getById(typeof exampleOrId === 'string' ? exampleOrId : exampleOrId._id);
  if (!example) {
    throw new Error(`Example not found: ${exampleOrId}`);
  }
  return db.remove(example);
}

/**
 * Duplicate an example, placing the copy right after the original under the same
 * request (midpoint metaSortKey). Only the caller-supplied name is honored;
 * parentId and metaSortKey are computed here.
 */
export async function duplicate(exampleOrId: Example | string, patch: { name?: string } = {}) {
  const example = await getById(typeof exampleOrId === 'string' ? exampleOrId : exampleOrId._id);
  if (!example) {
    throw new Error(`Example not found: ${exampleOrId}`);
  }

  // Only set name and "(Copy)" if the patch does not define it and the
  // example itself has a name.
  const name = patch.name ?? (example.name ? `${example.name} (Copy)` : '');

  // Get the sort key of the next example under the same parent, so the
  // duplicate lands right after the original when sorted by metaSortKey. Only
  // that key is needed: ask for one document and one field.
  const [nextExample] = await db.find<Example>(
    type,
    { parentId: example.parentId, metaSortKey: { $gt: example.metaSortKey } },
    { metaSortKey: 1 },
    1,
    { metaSortKey: 1 },
  );
  const metaSortKey = getMetaSortKeyAfter(example.metaSortKey, nextExample?.metaSortKey);

  return db.duplicate<Example>(example, { name, metaSortKey });
}
