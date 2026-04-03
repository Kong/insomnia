import { invariant } from '~/utils/invariant';

import { database as db } from '../../src/database';
import { models } from '../../src/models';
import { type McpRequest } from '../../src/models/types';

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
