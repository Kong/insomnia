import type { Request } from '~/insomnia-data';
import { database as db, models } from '~/insomnia-data';

const { type } = models.request;

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
  return db.findOne<Request>(type, { parentId });
}

export function findByParentId(parentId: string) {
  return db.find<Request>(type, { parentId });
}

export function update(request: Request, patch: Partial<Request>) {
  return db.docUpdate<Request>(request, patch);
}

export async function duplicate(request: Request, patch: Partial<Request> = {}) {
  if (!patch.name && request.name) {
    patch.name = `${request.name} (Copy)`;
  }

  const query = {
    metaSortKey: {
      $gt: request.metaSortKey,
    },
  };

  const [nextRequest] = await db.find<Request>(type, query, {
    metaSortKey: 1,
  });

  const nextSortKey = nextRequest ? nextRequest.metaSortKey : request.metaSortKey + 100;
  const sortKeyIncrement = (nextSortKey - request.metaSortKey) / 2;
  const metaSortKey = request.metaSortKey + sortKeyIncrement;
  return db.duplicate<Request>(request, {
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
