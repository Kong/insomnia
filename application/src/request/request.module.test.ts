import { describe, expect, it } from 'vitest';

import { RequestModule } from './request.module';
import { buildRequest, createFakeRequestRepository } from './testing/fake-request-repository';

describe('RequestModule', () => {
  it('updateById() delegates to updateRequest', async () => {
    const request = buildRequest({ name: 'Original' });
    const module = new RequestModule(createFakeRequestRepository([request]));

    const updated = await module.updateById(request._id, { name: 'Renamed' });

    expect(updated.name).toBe('Renamed');
  });

  it('deleteById() delegates to deleteRequest', async () => {
    const request = buildRequest();
    const repository = createFakeRequestRepository([request]);
    const module = new RequestModule(repository);

    await module.deleteById(request._id);

    expect(await repository.findById(request._id)).toBeNull();
  });
});
