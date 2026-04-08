import deepEqual from 'deep-equal';

import { compressObject, decompressObject } from '~/common/misc';
import type { GrpcRequest, McpRequest, Request, RequestVersion } from '~/insomnia-data';
import { database, database as db, models } from '~/insomnia-data';
import * as requestOperations from '~/models/helpers/request-operations';
import { isSocketIORequest, type SocketIORequest } from '~/models/socket-io-request';
import { isWebSocketRequest, type WebSocketRequest } from '~/models/websocket-request';

const { isRequest } = models.request;
const { type } = models.requestVersion;

const FIELDS_TO_IGNORE = [
  '_id',
  'type',
  'created',
  'modified',
  'metaSortKey',
  'description',
  'parentId',
  'name',
] as const;

export function getById(id: string) {
  return db.findOne<RequestVersion>(type, { _id: id });
}

export function findByParentId(parentId: string) {
  return db.find<RequestVersion>(type, { parentId });
}

export async function create(request: Request | WebSocketRequest | GrpcRequest | SocketIORequest | McpRequest) {
  if (
    !isRequest(request) &&
    !isWebSocketRequest(request) &&
    !isSocketIORequest(request) &&
    !models.mcpRequest.isMcpRequest(request)
  ) {
    throw new Error(`New ${type} was not given a valid ${request.type} instance`);
  }

  const parentId = request._id;
  const latestRequestVersion = await database.findOne<RequestVersion>(
    type,
    {
      parentId,
    },
    { modified: -1 },
  );
  const latestRequest = latestRequestVersion
    ? decompressObject<Request | WebSocketRequest | SocketIORequest>(latestRequestVersion.compressedRequest)
    : null;

  const hasChanged = diffRequests(latestRequest, request);

  if (hasChanged || !latestRequestVersion) {
    const compressedRequest = compressObject(request);
    return db.docCreate<RequestVersion>(type, {
      parentId,
      compressedRequest,
    });
  }

  return latestRequestVersion;
}

export async function restore(requestVersionId: string) {
  const requestVersion = await getById(requestVersionId);

  if (!requestVersion) {
    return null;
  }

  const requestPatch = decompressObject<Request | WebSocketRequest | GrpcRequest>(requestVersion.compressedRequest);

  if (!requestPatch) {
    return null;
  }

  const originalRequest = await requestOperations.getById(requestPatch._id);

  if (!originalRequest) {
    return null;
  }

  for (const field of FIELDS_TO_IGNORE) {
    if (field in requestPatch) {
      delete requestPatch[field];
    }
  }

  return requestOperations.update(originalRequest, requestPatch);
}

function diffRequests(
  previousRequest: Request | WebSocketRequest | SocketIORequest | McpRequest | null,
  nextRequest: Request | WebSocketRequest | SocketIORequest | McpRequest,
) {
  if (!previousRequest) {
    return true;
  }

  for (const key of Object.keys(previousRequest) as (keyof typeof previousRequest)[]) {
    if (FIELDS_TO_IGNORE.find(field => field === key)) {
      continue;
    }

    if (!deepEqual(previousRequest[key], nextRequest[key])) {
      return true;
    }
  }

  return false;
}

export function all() {
  return db.find<RequestVersion>(type);
}
