import type { Example, ExamplePatch, ExampleRequest, ExampleResponse, Query, Request } from 'insomnia-data';
import { database as db, models } from 'insomnia-data';

const { type } = models.example;

export function list(query?: Query<Example>, sort?: Record<string, any>, limit?: number) {
  return db.find<Example>(type, query, sort, limit);
}

export function get(query?: Query<Example>, sort?: Record<string, any>) {
  return db.findOne<Example>(type, query, sort);
}

export function getById(id: string) {
  return get({ _id: id });
}

export function listByParentIds(parentIds: string | string[]) {
  return list({ parentId: { $in: Array.isArray(parentIds) ? parentIds : [parentIds] } });
}

export async function create(patch: Partial<Example> = {}) {
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

  return db.docCreate<Example>(type, patch);
}

export interface CreateExampleFromRequestPayload {
  name: string;
  // Partial snapshot overriding the fields snapshotted from the parent request
  request?: Partial<ExampleRequest>;
  response?: Partial<ExampleResponse>;
}

/**
 * Create an Example snapshotting an HTTP Request. This is the single authority
 * for the creation invariants: the parent must exist, must be an HTTP request
 * (not a gRPC/WebSocket/… sibling), and — when `expectedWorkspaceId` is given —
 * must actually live under that workspace (it may be nested in folders).
 */
export async function createFromRequest(
  requestId: string,
  payload: CreateExampleFromRequestPayload,
  expectedWorkspaceId?: string,
) {
  const parentRequest = await db.findOne<Request>(models.request.type, { _id: requestId });
  if (!parentRequest) {
    throw new Error('Request not found');
  }
  if (!models.example.canHostExamples(parentRequest)) {
    throw new Error('Examples are only supported for plain HTTP requests');
  }
  if (expectedWorkspaceId) {
    const ancestors = await db.withAncestors(parentRequest, [models.requestGroup.type, models.workspace.type]);
    const workspaceDoc = ancestors.find(models.workspace.isWorkspace);
    if (workspaceDoc?._id !== expectedWorkspaceId) {
      throw new Error('Request does not belong to this workspace');
    }
  }

  const response: ExampleResponse = {
    statusCode: 200,
    statusMessage: '',
    headers: [],
    body: '',
    ...payload.response,
  };
  const requestSnapshot: ExampleRequest = {
    method: parentRequest.method,
    url: parentRequest.url,
    parameters: parentRequest.parameters,
    pathParameters: parentRequest.pathParameters,
    headers: parentRequest.headers,
    body: parentRequest.body,
    ...payload.request,
  };

  return await create({
    parentId: requestId,
    name: payload.name,
    description: '',
    request: requestSnapshot,
    response,
  });
}

/**
 * Incremental update. Re-reads the authoritative snapshot, applies the shared
 * patch invariants (`applyExamplePatch`: identity stripping, shallow merge,
 * statusCode type check) and, when `expectedParentId` is given, verifies the
 * example still lives under that request before writing. Throws on unknown
 * ids, parent mismatch or invalid patches.
 */
export async function update(exampleOrId: Example | string, patch: ExamplePatch, expectedParentId?: string) {
  const example = await getById(typeof exampleOrId === 'string' ? exampleOrId : exampleOrId._id);
  if (!example) {
    throw new Error(`Example not found: ${exampleOrId}`);
  }
  if (expectedParentId && example.parentId !== expectedParentId) {
    throw new Error(`Example ${example._id} does not belong to request ${expectedParentId}`);
  }
  const merged = models.example.applyExamplePatch(example, patch);
  if (Object.keys(merged).length === 0) {
    return example;
  }
  return db.docUpdate<Example>(example, merged);
}

/**
 * Remove an example. When `expectedParentId` is given, refuses examples that no
 * longer live under that request (stale references must not delete sibling
 * data).
 */
export async function remove(exampleOrId: Example | string, expectedParentId?: string) {
  const example = await getById(typeof exampleOrId === 'string' ? exampleOrId : exampleOrId._id);
  if (!example) {
    throw new Error(`Example not found: ${exampleOrId}`);
  }
  if (expectedParentId && example.parentId !== expectedParentId) {
    throw new Error(`Example ${example._id} does not belong to request ${expectedParentId}`);
  }
  return db.remove(example);
}

/**
 * Duplicate an example, placing the copy right after the original under the
 * same request (midpoint metaSortKey). Only the caller-supplied name is
 * honored; parentId and metaSortKey are computed here and can never be
 * overridden through the patch.
 */
export async function duplicate(
  exampleOrId: Example | string,
  patch: { name?: string } = {},
  expectedParentId?: string,
) {
  const example = await getById(typeof exampleOrId === 'string' ? exampleOrId : exampleOrId._id);
  if (!example) {
    throw new Error(`Example not found: ${exampleOrId}`);
  }
  if (expectedParentId && example.parentId !== expectedParentId) {
    throw new Error(`Example ${example._id} does not belong to request ${expectedParentId}`);
  }

  // Only set name and "(Copy)" if the patch does not define it and the
  // example itself has a name.
  const name = patch.name ?? (example.name ? `${example.name} (Copy)` : '');

  // Get the sort key of the next example under the same parent, so the
  // duplicate lands right after the original when sorted by metaSortKey.
  const [nextExample] = await db.find<Example>(
    type,
    { parentId: example.parentId, metaSortKey: { $gt: example.metaSortKey } },
    { metaSortKey: 1 },
  );
  const nextSortKey = nextExample ? nextExample.metaSortKey : example.metaSortKey + 100;
  const metaSortKey = example.metaSortKey + (nextSortKey - example.metaSortKey) / 2;

  return db.duplicate<Example>(example, { name, metaSortKey });
}
