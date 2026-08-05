import { database, services } from 'insomnia-data';
import type { AnyRequest } from 'insomnia-domain';
import { runRequestRepositoryContractTests } from 'insomnia-domain/testing';

import { nedbRequestRepository } from './nedb-request-repository';

// Patches are loosely typed here since each services.*.create() expects its own variant-specific
// partial, not the AnyRequest union this test fixture factory is parameterized over.
const createByType: Record<AnyRequest['type'], (patch: any) => Promise<{ _id: string }>> = {
  Request: patch => services.request.create(patch),
  GrpcRequest: patch => services.grpcRequest.create(patch),
  WebSocketRequest: patch => services.webSocketRequest.create(patch),
  SocketIORequest: patch => services.socketIORequest.create(patch),
  McpRequest: patch => services.mcpRequest.create(patch),
};

runRequestRepositoryContractTests(() => ({
  repository: nedbRequestRepository,
  async createRequest(type, patch) {
    const doc = await createByType[type]({ parentId: 'fld_contract_test', ...patch });
    const request = await nedbRequestRepository.findById(doc._id);
    if (!request) {
      throw new Error(`Failed to seed fixture ${type} ${doc._id}`);
    }
    return request;
  },
  async reset() {
    await database.init({ inMemoryOnly: true }, true);
  },
}));
