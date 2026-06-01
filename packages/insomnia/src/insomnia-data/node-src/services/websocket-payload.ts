import type { WebSocketPayload } from 'insomnia-data';
import { database, models } from 'insomnia-data';

const { type, name } = models.webSocketPayload;

export const create = (patch: Partial<WebSocketPayload> = {}) => {
  if (!patch.parentId) {
    throw new Error(`New WebSocketPayload missing \`parentId\`: ${JSON.stringify(patch)}`);
  }

  return database.docCreate<WebSocketPayload>(type, patch);
};

export const remove = (obj: WebSocketPayload) => database.remove(obj);

export const update = (obj: WebSocketPayload, patch: Partial<WebSocketPayload> = {}) => database.docUpdate(obj, patch);

export async function duplicate(request: WebSocketPayload, patch: Partial<WebSocketPayload> = {}) {
  // Only set name and "(Copy)" if the patch does
  // not define it and the request itself has a name.
  // Otherwise leave it blank so the request URL can
  // fill it in automatically.
  if (!patch.name && request.name) {
    patch.name = `${request.name} (Copy)`;
  }

  return database.duplicate<WebSocketPayload>(request, {
    name,
    ...patch,
  });
}

export const getById = (_id: string) => database.findOne<WebSocketPayload>(type, { _id });
export const getByParentId = (parentId: string) => database.findOne<WebSocketPayload>(type, { parentId });

export const all = () => database.find<WebSocketPayload>(type);
