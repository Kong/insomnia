import { database } from '../../src/database';
import { models } from '../../src/models';
import { type WebSocketRequest } from '../../src/models/types';

const { type, name } = models.webSocketRequest;

export const create = (patch: Partial<WebSocketRequest> = {}) => {
  if (!patch.parentId) {
    throw new Error(`New WebSocketRequest missing \`parentId\`: ${JSON.stringify(patch)}`);
  }

  return database.docCreate<WebSocketRequest>(type, patch);
};

export const remove = (obj: WebSocketRequest) => database.remove(obj);

export const update = (obj: WebSocketRequest, patch: Partial<WebSocketRequest> = {}) => database.docUpdate(obj, patch);

// This is duplicated (lol) from models/request.js
export async function duplicate(request: WebSocketRequest, patch: Partial<WebSocketRequest> = {}) {
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

  const [nextRequest] = await database.find<WebSocketRequest>(type, q, {
    metaSortKey: 1,
  });
  const nextSortKey = nextRequest ? nextRequest.metaSortKey : request.metaSortKey + 100;
  // Calculate new sort key
  const sortKeyIncrement = (nextSortKey - request.metaSortKey) / 2;
  const metaSortKey = request.metaSortKey + sortKeyIncrement;
  return database.duplicate<WebSocketRequest>(request, {
    name,
    metaSortKey,
    ...patch,
  });
}

export const getById = (_id: string) => database.findOne<WebSocketRequest>(type, { _id });

export const findByParentId = (parentId: string) => database.find<WebSocketRequest>(type, { parentId });

export const all = () => database.find<WebSocketRequest>(type);
