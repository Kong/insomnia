/**
 * Overview:
 * This migration is for Insomnia schema version 5.2.
 * Each child (request or folder) inside a `collection` array now carries an explicit `type`
 * field ("Request", "GrpcRequest", "WebSocketRequest", "SocketIORequest", or "RequestGroup").
 * import-v5-parser.ts uses it as a real Zod discriminant instead of trying every possible
 * schema against an untagged payload.
 * Files exported before this version don't have the field, so this migration infers it from
 * the same fields the exporter has always written per type, and adds it to every collection
 * item, recursively through nested folders.
 *
 * Usage:
 * - Used during data import to upgrade collection files from before 5.2 to carry the `type` tag.
 */
import { models } from 'insomnia-data';
const { request, requestGroup, grpcRequest, webSocketRequest, socketIORequest } = models;

import type { InsomniaFile, RequestCollectionChild } from '../import-v5-parser';

type RequestTypes =
  | typeof request.type
  | typeof grpcRequest.type
  | typeof webSocketRequest.type
  | typeof socketIORequest.type
  | typeof requestGroup.type;

function inferCollectionItemType(item: RequestCollectionChild): RequestTypes {
  if (item) {
    const itemMeta = 'meta' in item ? item.meta : null;
    const itemId = itemMeta?.id || '';
    // Detect groups: items that are NOT requests, gRPC, or WebSocket
    const isGroup = !('method' in item) && !('reflectionApi' in item) && !('url' in item);

    if (
      'protoFileId' in item ||
      'metadata' in item ||
      'reflectionApi' in item ||
      itemId.startsWith(models.grpcRequest.prefix)
    ) {
      return 'GrpcRequest';
    }

    if (isGroup || 'children' in item || itemId.startsWith(models.requestGroup.prefix)) {
      return 'RequestGroup';
    }

    if (('method' in item && item.method) || itemId.startsWith(models.request.prefix)) {
      return 'Request';
    }

    if ('eventListeners' in item || itemId.startsWith(models.socketIORequest.prefix)) {
      return 'SocketIORequest';
    }

    if (itemId.startsWith(models.webSocketRequest.prefix)) {
      return 'WebSocketRequest';
    }
  }
  return 'Request';
}

function tagCollectionItems(collection: RequestCollectionChild[]): RequestCollectionChild[] {
  return collection.map(item => {
    item.type = inferCollectionItemType(item);

    if ('children' in item && Array.isArray(item.children)) {
      item.children = tagCollectionItems(item.children);
    }

    return item;
  });
}

/**
 * Adds the `type` tag to every item in `data.collection`, recursively through nested folders.
 * Leaves data without a `collection` array (environments, mock servers, MCP clients) untouched.
 */
export function addCollectionItemTypeFields<T extends InsomniaFile>(data: T): T {
  if (!data || typeof data !== 'object' || !('type' in data)) {
    return data;
  }
  const type = data.type;
  if (
    (type === 'collection.insomnia.rest/5.0' || type === 'spec.insomnia.rest/5.0') &&
    Array.isArray(data.collection)
  ) {
    data.collection = tagCollectionItems(data.collection) as typeof data.collection;
  }

  return data;
}
