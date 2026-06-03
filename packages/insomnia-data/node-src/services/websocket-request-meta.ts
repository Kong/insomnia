import type { WebSocketRequestMeta } from 'insomnia-data';
import { database as db, models } from 'insomnia-data';

const { type } = models.webSocketRequestMeta;
const { isWebSocketRequestId } = models.webSocketRequest;

function expectParentToBeWebSocketRequest(parentId: string | null) {
  if (!isWebSocketRequestId(parentId)) {
    throw new Error('Expected the parent of WebSocketRequestMeta to be a WebSocketRequest');
  }
}

export function create(patch: Partial<WebSocketRequestMeta> = {}) {
  if (!patch.parentId) {
    throw new Error('New WebSocketRequestMeta missing `parentId`');
  }

  expectParentToBeWebSocketRequest(patch.parentId);
  return db.docCreate<WebSocketRequestMeta>(type, patch);
}

export function update(requestMeta: WebSocketRequestMeta, patch: Partial<WebSocketRequestMeta>) {
  expectParentToBeWebSocketRequest(patch.parentId || requestMeta.parentId);
  return db.docUpdate(requestMeta, patch);
}

export function getByParentId(parentId: string) {
  expectParentToBeWebSocketRequest(parentId);
  return db.findOne<WebSocketRequestMeta>(type, { parentId });
}

export async function getOrCreateByParentId(parentId: string) {
  const requestMeta = await getByParentId(parentId);

  if (requestMeta) {
    return requestMeta;
  }

  return create({ parentId });
}

export async function updateOrCreateByParentId(parentId: string, patch: Partial<WebSocketRequestMeta>) {
  const requestMeta = await getByParentId(parentId);

  if (requestMeta) {
    return update(requestMeta, patch);
  }
  const newPatch = Object.assign(
    {
      parentId,
    },
    patch,
  );
  return create(newPatch);
}

export function all() {
  return db.find<WebSocketRequestMeta>(type);
}
