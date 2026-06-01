import type { McpRequest } from '~/insomnia-data';
import { database as db, models } from '~/insomnia-data';
import { invariant } from '~/insomnia-data/common';

const { type } = models.mcpRequest;

export function create(patch: Partial<McpRequest> = {}) {
  if (!patch.parentId) {
    throw new Error('New McpRequest missing `parentId`');
  }

  return db.docCreate<McpRequest>(type, patch);
}

export function remove(obj: McpRequest) {
  return db.remove(obj);
}

export function all() {
  return db.find<McpRequest>(type);
}

export function getByParentId(parentId: string) {
  return db.findOne<McpRequest>(type, { parentId });
}

export function getById(id: string) {
  return db.findOne<McpRequest>(type, { _id: id });
}

export function update(request: McpRequest, patch: Partial<McpRequest> = {}) {
  return db.docUpdate<McpRequest>(request, patch);
}

export async function clearResourceSubscriptions(requestId: string) {
  const request = await getById(requestId);
  invariant(request, 'McpRequest not found');
  return update(request, { subscribeResources: [] });
}
