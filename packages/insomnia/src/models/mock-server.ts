import { database as db } from '../common/database';
import { type BaseModel, workspace } from './index';

export const name = 'Mock Server';

export const type = 'MockServer';

export const prefix = 'mock';

export const canDuplicate = true;

export const canSync = true;

interface BaseMockServer {
  parentId: string;
  name: string;
  url: string;
  useInsomniaCloud: boolean;
}

export type MockServer = BaseModel & BaseMockServer;

export function init(): BaseMockServer {
  return {
    parentId: '',
    name: 'New Mock',
    url: 'http://localhost:8080',
    useInsomniaCloud: true,
  };
}

export const isMockServer = (model: Pick<BaseModel, 'type'>): model is MockServer => (
  model.type === type
);

export function migrate(doc: MockServer) {
  return doc;
}

export function create(patch: Partial<MockServer> = {}) {
  if (!patch.parentId) {
    throw new Error('New MockServer missing `parentId`: ' + JSON.stringify(patch));
  }

  return db.docCreate<MockServer>(type, patch);
}
export async function getOrCreateForParentId(
  workspaceId: string,
  patch: Partial<MockServer> = {},
) {
  const mockServer = await db.getWhere<MockServer>(type, {
    parentId: workspaceId,
  });

  if (!mockServer) {
    return db.docCreate<MockServer>(type, { ...patch, parentId: workspaceId });
  }

  return mockServer;
}
export function update(
  mockServer: MockServer,
  patch: Partial<MockServer> = {},
) {
  return db.docUpdate<MockServer>(mockServer, patch);
}

export function getById(id: string) {
  return db.get<MockServer>(type, id);
}

export function getByParentId(parentId: string) {
  return db.getWhere<MockServer>(type, { parentId });
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
  return db.all<MockServer>(type);
}
