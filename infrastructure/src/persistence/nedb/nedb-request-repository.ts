import type {
  GrpcRequest as DataGrpcRequest,
  McpRequest as DataMcpRequest,
  Request as DataRequest,
  SocketIORequest as DataSocketIORequest,
  WebSocketRequest as DataWebSocketRequest,
} from 'insomnia-data';
import { database } from 'insomnia-data';
import type { AnyRequest, RequestRepository } from 'insomnia-domain';
import { getRequestTypeFromId } from 'insomnia-domain';

type AnyDataRequest = DataRequest | DataGrpcRequest | DataWebSocketRequest | DataSocketIORequest | DataMcpRequest;

// The five variants' domain entities are structurally faithful mirrors of their insomnia-data
// counterparts (verified field-by-field when defining them) - a single structural cast here,
// rather than five near-identical hand-written field mappers, given how many fields there are
// across all five variants combined.
const toDomainRequest = (doc: AnyDataRequest): AnyRequest => doc as unknown as AnyRequest;

const REQUEST_TYPES = ['Request', 'GrpcRequest', 'WebSocketRequest', 'SocketIORequest', 'McpRequest'] as const;

// Thin adapter over insomnia-data's existing database calls. database.update()/remove() already
// dispatch on the doc's own `type` field internally (see database-nedb.ts), so this adapter
// doesn't need a per-variant switch for save()/delete() - only findById() (which needs a type to
// query with, derived from the id's prefix) and findByParentId() (which must query all five types
// and merge) need to know about the variants explicitly.
export const nedbRequestRepository: RequestRepository = {
  async findById(id) {
    const type = getRequestTypeFromId(id);
    if (!type) {
      return null;
    }
    const doc = await database.findOne<AnyDataRequest>(type, { _id: id });
    return doc ? toDomainRequest(doc) : null;
  },

  async findByParentId(parentId) {
    const docsByType = await Promise.all(REQUEST_TYPES.map(type => database.find<AnyDataRequest>(type, { parentId })));
    return docsByType.flat().map(toDomainRequest);
  },

  async save(request) {
    await database.update(request as unknown as AnyDataRequest);
  },

  async delete(id) {
    const type = getRequestTypeFromId(id);
    if (!type) {
      return;
    }
    const doc = await database.findOne<AnyDataRequest>(type, { _id: id });
    if (doc) {
      await database.remove(doc);
    }
  },
};
