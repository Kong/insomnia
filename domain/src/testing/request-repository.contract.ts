import { beforeEach, describe, expect, it } from 'vitest';

import type { AnyRequest } from '../request/any-request.entity';
import type { RequestRepository } from '../request/request-repository.port';

export interface RequestRepositoryContractContext {
  repository: RequestRepository;
  /**
   * Seeds a fixture request of the given variant through whatever path the implementation under
   * test provides.
   */
  createRequest: (type: AnyRequest['type'], patch?: Partial<AnyRequest>) => Promise<AnyRequest>;
  /** Resets storage to empty between tests. */
  reset: () => Promise<void>;
}

const VARIANTS: AnyRequest['type'][] = ['Request', 'GrpcRequest', 'WebSocketRequest', 'SocketIORequest', 'McpRequest'];

/**
 * Shared contract test suite for any RequestRepository implementation - run this against
 * NedbRequestRepository today, and against SqliteRequestRepository once it exists, so both stay
 * behaviorally identical. Exercises every request variant through the same aggregate-root port.
 */
export function runRequestRepositoryContractTests(getContext: () => RequestRepositoryContractContext) {
  describe('RequestRepository contract', () => {
    beforeEach(async () => {
      await getContext().reset();
    });

    it('findById returns null for a missing id', async () => {
      const { repository } = getContext();

      expect(await repository.findById('req_does_not_exist')).toBeNull();
    });

    it.each(VARIANTS)('findById returns a previously saved %s', async type => {
      const { repository, createRequest } = getContext();
      const request = await createRequest(type);

      expect(await repository.findById(request._id)).toEqual(request);
    });

    it('findByParentId returns every variant under that parent, and none from another parent', async () => {
      const { repository, createRequest } = getContext();
      const parentId = 'fld_contract_test';
      const created = await Promise.all(VARIANTS.map(type => createRequest(type, { parentId })));
      const other = await createRequest('Request', { parentId: 'fld_other' });

      const found = await repository.findByParentId(parentId);

      expect(found.map(r => r._id).sort()).toEqual(created.map(r => r._id).sort());
      expect(found.some(r => r._id === other._id)).toBe(false);
    });

    // Uses `description` rather than `name` here: every variant's own init() declares a default
    // `description`, but McpRequest's init() declares no `name` default (see mcp-request.entity.ts)
    // - insomnia-data's initModel() prunes fields a model's init()/optionalKeys don't know about,
    // so `name` doesn't reliably round-trip for McpRequest specifically. `description` does, for
    // all five variants, making it the right uniform field for this test.
    it.each(VARIANTS)('save() persists changes to an existing %s', async type => {
      const { repository, createRequest } = getContext();
      const request = await createRequest(type, { description: 'Original' });

      await repository.save({ ...request, description: 'Renamed' });

      expect((await repository.findById(request._id))?.description).toBe('Renamed');
    });

    it.each(VARIANTS)('delete() removes the %s', async type => {
      const { repository, createRequest } = getContext();
      const request = await createRequest(type);

      await repository.delete(request._id);

      expect(await repository.findById(request._id)).toBeNull();
    });
  });
}
