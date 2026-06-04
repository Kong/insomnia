import type { SocketIORequest } from 'insomnia-data';
import { database, models } from 'insomnia-data';

const { type, name } = models.socketIORequest;

export const create = (patch: Partial<SocketIORequest> = {}) => {
  if (!patch.parentId) {
    throw new Error(`New Socket.IO Request missing \`parentId\`: ${JSON.stringify(patch)}`);
  }

  return database.docCreate<SocketIORequest>(type, patch);
};

export const getById = (_id: string) => database.findOne<SocketIORequest>(type, { _id });

export const findByParentId = (parentId: string) => database.find<SocketIORequest>(type, { parentId });

export const remove = (obj: SocketIORequest) => database.remove(obj);

export const update = (obj: SocketIORequest, patch: Partial<SocketIORequest> = {}) => database.docUpdate(obj, patch);

// This is duplicated (lol) from models/request.js
export async function duplicate(request: SocketIORequest, patch: Partial<SocketIORequest> = {}) {
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

  const [nextRequest] = await database.find<SocketIORequest>(type, q, {
    metaSortKey: 1,
  });
  const nextSortKey = nextRequest ? nextRequest.metaSortKey : request.metaSortKey + 100;
  // Calculate new sort key
  const sortKeyIncrement = (nextSortKey - request.metaSortKey) / 2;
  const metaSortKey = request.metaSortKey + sortKeyIncrement;
  return database.duplicate<SocketIORequest>(request, {
    name,
    metaSortKey,
    ...patch,
  });
}
