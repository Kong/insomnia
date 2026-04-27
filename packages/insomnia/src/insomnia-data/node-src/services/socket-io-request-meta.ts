import type { SocketIORequestMeta } from '~/insomnia-data';
import { database as db, models } from '~/insomnia-data';

const { type } = models.socketIORequestMeta;
const { isSocketIORequestId } = models.socketIORequest;

function expectParentToBeSocketIORequest(parentId: string | null) {
  if (!isSocketIORequestId(parentId)) {
    throw new Error('Expected the parent of SocketIORequestMeta to be a SocketIORequest');
  }
}

export function create(patch: Partial<SocketIORequestMeta> = {}) {
  if (!patch.parentId) {
    throw new Error('New SocketIORequestMeta missing `parentId`');
  }

  expectParentToBeSocketIORequest(patch.parentId);
  return db.docCreate<SocketIORequestMeta>(type, patch);
}

export function update(requestMeta: SocketIORequestMeta, patch: Partial<SocketIORequestMeta>) {
  expectParentToBeSocketIORequest(patch.parentId || requestMeta.parentId);
  return db.docUpdate(requestMeta, patch);
}

export function getByParentId(parentId: string) {
  expectParentToBeSocketIORequest(parentId);
  return db.findOne<SocketIORequestMeta>(type, { parentId });
}

export async function getOrCreateByParentId(parentId: string) {
  const requestMeta = await getByParentId(parentId);

  if (requestMeta) {
    return requestMeta;
  }

  return create({ parentId });
}

export async function updateOrCreateByParentId(parentId: string, patch: Partial<SocketIORequestMeta>) {
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
  return db.find<SocketIORequestMeta>(type);
}
