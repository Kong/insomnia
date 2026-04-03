import type { Project, Stats, Workspace } from '~/insomnia-data';
import { database as db } from '~/insomnia-data';
import * as models from '~/models';
import type { RequestGroup } from '~/models/request-group';

const { type } = models.stats;
const { isRequest } = models.request;
const { isWebSocketRequest } = models.webSocketRequest;
const { isSocketIORequest } = models.socketIORequest;

export function create(patch: Partial<Stats> = {}) {
  return db.docCreate<Stats>(type, patch);
}

export async function update(patch: Partial<Stats>) {
  const stats = await get();
  return db.docUpdate<Stats>(stats, patch);
}

export async function get() {
  const result = await db.findOne<Stats>(type);

  if (!result) {
    return create();
  }
  return result;
}

export function all() {
  return db.find<Stats>(type) || [];
}

export async function incrementRequestStats({ createdRequests, deletedRequests, executedRequests }: Partial<Stats>) {
  const stats = await get();
  await update({
    ...(createdRequests && {
      createdRequests: stats.createdRequests + createdRequests,
    }),
    ...(deletedRequests && {
      deletedRequests: stats.deletedRequests + deletedRequests,
    }),
    ...(executedRequests && {
      executedRequests: stats.executedRequests + executedRequests,
    }),
  });
}

export async function incrementCreatedRequests() {
  await incrementRequestStats({
    createdRequests: 1,
  });
}

export async function incrementDeletedRequests() {
  await incrementRequestStats({
    deletedRequests: 1,
  });
}

export async function incrementExecutedRequests() {
  await incrementRequestStats({
    executedRequests: 1,
  });
}

export async function incrementCreatedRequestsForDescendents(doc: Workspace | RequestGroup) {
  const docs = await db.getWithDescendants(doc, [
    models.request.type,
    models.grpcRequest.type,
    models.webSocketRequest.type,
    models.socketIORequest.type,
  ]);
  const requests = docs.filter(
    doc => isRequest(doc) || models.grpcRequest.isGrpcRequest(doc) || isWebSocketRequest(doc) || isSocketIORequest(doc),
  );
  await incrementRequestStats({
    createdRequests: requests.length,
  });
}

export async function incrementDeletedRequestsForDescendents(doc: Workspace | RequestGroup | Project) {
  const docs = await db.getWithDescendants(doc, [
    models.request.type,
    models.grpcRequest.type,
    models.webSocketRequest.type,
    models.socketIORequest.type,
  ]);
  const requests = docs.filter(
    doc => isRequest(doc) || models.grpcRequest.isGrpcRequest(doc) || isWebSocketRequest(doc) || isSocketIORequest(doc),
  );
  await incrementRequestStats({
    deletedRequests: requests.length,
  });
}
