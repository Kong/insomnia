import { describe, expect, it } from 'vitest';

import { RequestModule } from './request.module';
import { buildRequest, createFakeRequestRepository } from './testing/fake-request-repository';

describe('RequestModule', () => {
  it('deleteById() delegates to deleteRequest', async () => {
    const request = buildRequest();
    const repository = createFakeRequestRepository([request]);
    const module = new RequestModule(repository);

    await module.deleteById(request._id);

    expect(await repository.findById(request._id)).toBeNull();
  });
});
