import deepEqual from 'deep-equal';

import { compressObject, decompressObject } from '~/common/misc';
import type {
  GrpcRequest,
  McpRequest,
  Request,
  RequestVersion,
  SocketIORequest,
  WebSocketRequest,
} from '~/insomnia-data';
import { database, database as db, models } from '~/insomnia-data';

import * as requestHelpers from './helpers/request-operations';

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
    !models.webSocketRequest.isWebSocketRequest(request) &&
    !models.socketIORequest.isSocketIORequest(request) &&
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

  const hasChanged = _diffRequests(latestRequest, request);

  if (hasChanged || !latestRequestVersion) {
    // Create a new version if the request has been modified
    const compressedRequest = compressObject(request);
    return db.docCreate<RequestVersion>(type, {
      parentId,
      compressedRequest,
    });
  }
  // Re-use the latest version if not modified since
  return latestRequestVersion;
}

export async function restore(requestVersionId: string) {
  const requestVersion = await getById(requestVersionId);

  // Older responses won't have versions saved with them
  if (!requestVersion) {
    return null;
  }

  const requestPatch = decompressObject<Request | WebSocketRequest | GrpcRequest>(requestVersion.compressedRequest);

  if (!requestPatch) {
    return null;
  }

  const originalRequest = await requestHelpers.getRequestById(requestPatch._id);

  if (!originalRequest) {
    return null;
  }

  // Only restore fields that aren't blacklisted
  for (const field of FIELDS_TO_IGNORE) {
    if (field in requestPatch) {
      delete requestPatch[field];
    }
  }

  return requestHelpers.updateRequest(originalRequest, requestPatch);
}
function _diffRequests(
  rOld: Request | WebSocketRequest | SocketIORequest | McpRequest | null,
  rNew: Request | WebSocketRequest | SocketIORequest | McpRequest,
) {
  if (!rOld) {
    return true;
  }

  for (const key of Object.keys(rOld) as (keyof typeof rOld)[]) {
    // Skip fields that aren't useful
    if (FIELDS_TO_IGNORE.find(field => field === key)) {
      continue;
    }
    if (!deepEqual(rOld[key], rNew[key])) {
      return true;
    }
  }

  return false;
}

export function all() {
  return db.find<RequestVersion>(type);
}
