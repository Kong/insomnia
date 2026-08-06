import { describe, expect, it } from 'vitest';

import { deleteRequest } from './delete-request.use-case';
import { buildRequest, createFakeRequestRepository } from './testing/fake-request-repository';

describe('deleteRequest', () => {
  it('deletes an existing request', async () => {
    const request = buildRequest();
    const repository = createFakeRequestRepository([request]);

    await deleteRequest(repository, request._id);

    expect(await repository.findById(request._id)).toBeNull();
  });

  it('throws when the request does not exist', async () => {
    const repository = createFakeRequestRepository([]);

    await expect(deleteRequest(repository, 'req_missing')).rejects.toThrow('Request not found');
  });
});
