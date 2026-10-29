import type { Example, Request } from 'insomnia-data';
import { database as db, models } from 'insomnia-data';

const { type, name } = models.request;

/**
 * Promote an Example back into a first-class Request, created right after the
 * example's parent request among its HTTP request siblings (midpoint of the
 * parent's and the next sibling's metaSortKey). Refuses unknown examples and
 * examples that no longer live under `expectedParentId`.
 */
export async function createFromExample(exampleId: string, expectedParentId: string) {
  const example = await db.findOne<Example>(models.example.type, { _id: exampleId });
  if (!example) {
    throw new Error('Example not found');
  }
  if (example.parentId !== expectedParentId) {
    throw new Error(`Example ${exampleId} does not belong to request ${expectedParentId}`);
  }

  const parentRequest = await getById(example.parentId);
  if (!parentRequest) {
    throw new Error('Request not found');
  }

  // Land right after the parent request among its HTTP request siblings
  // (midpoint of the parent's and the next sibling's metaSortKey).
  const siblings = await findByParentId(parentRequest.parentId);
  const [nextRequest] = siblings
    .filter(sibling => sibling.metaSortKey > parentRequest.metaSortKey)
    .sort((a, b) => a.metaSortKey - b.metaSortKey);
  const nextSortKey = nextRequest ? nextRequest.metaSortKey : parentRequest.metaSortKey + 100;
  const metaSortKey = parentRequest.metaSortKey + (nextSortKey - parentRequest.metaSortKey) / 2;

  return create({
    parentId: parentRequest.parentId,
    name: example.name || parentRequest.name,
    description: example.description,
    method: example.request.method,
    url: example.request.url,
    parameters: example.request.parameters,
    pathParameters: example.request.pathParameters ?? parentRequest.pathParameters,
    headers: example.request.headers,
    body: example.request.body,
    authentication: example.request.authentication as Request['authentication'],
    metaSortKey,
  });
}

export function create(patch: Partial<Request> = {}) {
  if (!patch.parentId) {
    throw new Error(`New Requests missing \`parentId\`: ${JSON.stringify(patch)}`);
  }

  return db.docCreate<Request>(type, patch);
}

export function getById(id: string): Promise<Request | undefined> {
  return db.findOne<Request>(type, { _id: id });
}

export function getByParentId(parentId: string) {
  return db.findOne<Request>(type, { parentId: parentId });
}

export function findByParentId(parentId: string) {
  return db.find<Request>(type, { parentId: parentId });
}

export function update(request: Request, patch: Partial<Request>) {
  return db.docUpdate<Request>(request, patch);
}

export async function duplicate(request: Request, patch: Partial<Request> = {}) {
  // Only set name and "(Copy)" if the patch does
  // not define it and the request itself has a name.
  // Otherwise leave it blank so the request URL can
  // fill it in automatically.
  if (!patch.name && request.name) {
    patch.name = `${request.name} (Copy)`;
  }

  // Get sort key of next request
  const q = {
    metaSortKey: {
      $gt: request.metaSortKey,
    },
  };

  const [nextRequest] = await db.find<Request>(type, q, {
    metaSortKey: 1,
  });

  const nextSortKey = nextRequest ? nextRequest.metaSortKey : request.metaSortKey + 100;
  // Calculate new sort key
  const sortKeyIncrement = (nextSortKey - request.metaSortKey) / 2;
  const metaSortKey = request.metaSortKey + sortKeyIncrement;
  return db.duplicate<Request>(request, {
    name,
    metaSortKey,
    ...patch,
  });
}

export function remove(request: Request) {
  return db.remove(request);
}

export async function all() {
  return db.find<Request>(type);
}
