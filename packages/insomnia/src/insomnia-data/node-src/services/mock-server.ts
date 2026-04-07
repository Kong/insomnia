import { database as db } from '../../src/database';
import { models } from '../../src/models';
import { type MockServer } from '../../src/models/types';
import * as workspace from './workspace';

const { type } = models.mockServer;

export function create(patch: Partial<MockServer> = {}) {
  if (!patch.parentId) {
    throw new Error('New MockServer missing `parentId`: ' + JSON.stringify(patch));
  }

  return db.docCreate<MockServer>(type, patch);
}
export async function getOrCreateForParentId(workspaceId: string, patch: Partial<MockServer> = {}) {
  const mockServer = await db.findOne<MockServer>(type, {
    parentId: workspaceId,
  });

  if (!mockServer) {
    return db.docCreate<MockServer>(type, { ...patch, parentId: workspaceId });
  }

  return mockServer;
}
export function update(mockServer: MockServer, patch: Partial<MockServer> = {}) {
  return db.docUpdate<MockServer>(mockServer, patch);
}

export function getById(id: string) {
  return db.findOne<MockServer>(type, { _id: id });
}

export function getByParentId(parentId: string) {
  return db.findOne<MockServer>(type, { parentId });
}

export async function findByProjectId(projectId: string) {
  const workspaces = await workspace.findByParentId(projectId);
  return db.find<MockServer>(type, { parentId: { $in: workspaces.map(ws => ws._id) } });
}

export function removeWhere(parentId: string) {
  return db.removeWhere(type, { parentId });
}

export function remove(mockServer: MockServer) {
  return db.remove(mockServer);
}

export function all() {
  return db.find<MockServer>(type);
}
