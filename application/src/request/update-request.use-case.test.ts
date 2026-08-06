import type { Request } from 'insomnia-domain';
import { describe, expect, it } from 'vitest';

import { buildRequest, createFakeRequestRepository } from './testing/fake-request-repository';
import { updateRequest } from './update-request.use-case';

describe('updateRequest', () => {
  it('applies a plain patch as-is', async () => {
    const request = buildRequest({ name: 'Original' });
    const repository = createFakeRequestRepository([request]);

    const updated = await updateRequest(repository, request._id, { name: 'Renamed' });

    expect(updated.name).toBe('Renamed');
    expect((await repository.findById(request._id))?.name).toBe('Renamed');
  });

  it('throws when the request does not exist', async () => {
    const repository = createFakeRequestRepository([]);

    await expect(updateRequest(repository, 'req_missing', { name: 'Renamed' })).rejects.toThrow('Request not found');
  });

  it('recomputes pathParameters, preserving existing values, when the url changes', async () => {
    const request = buildRequest({
      url: 'https://example.com/users/:id',
      pathParameters: [{ name: 'id', value: '42' }],
    });
    const repository = createFakeRequestRepository([request]);

    const updated = await updateRequest(repository, request._id, {
      url: 'https://example.com/users/:id/posts/:postId',
    });

    expect(updated).toMatchObject({
      pathParameters: [
        { name: 'id', value: '42' },
        { name: 'postId', value: '' },
      ],
    });
  });

  it('does not recompute pathParameters when the url is unchanged', async () => {
    const request = buildRequest({ url: 'https://example.com/users/:id', pathParameters: [{ name: 'id', value: '42' }] });
    const repository = createFakeRequestRepository([request]);

    const updated = (await updateRequest(repository, request._id, {
      url: 'https://example.com/users/:id',
      name: 'Renamed',
    })) as Request;

    expect(updated.pathParameters).toEqual([{ name: 'id', value: '42' }]);
  });

  it('rewrites body and headers when a Request (HTTP) mimeType changes', async () => {
    const request = buildRequest({
      body: { mimeType: 'text/plain', text: 'hello' },
      headers: [{ name: 'Content-Type', value: 'text/plain' }],
    });
    const repository = createFakeRequestRepository([request]);

    const updated = (await updateRequest(repository, request._id, {
      body: { mimeType: 'application/octet-stream' },
    })) as Request;

    expect(updated.body).toEqual({ mimeType: 'application/octet-stream', fileName: '' });
    expect(updated.headers).toEqual([{ name: 'Content-Type', value: 'application/octet-stream' }]);
  });

  it('composes a simultaneous url change and mimeType change, matching the prior route behavior', async () => {
    const request = buildRequest({
      url: 'https://example.com/old',
      body: { mimeType: 'text/plain', text: 'hello' },
      headers: [{ name: 'Content-Type', value: 'text/plain' }],
    });
    const repository = createFakeRequestRepository([request]);

    const updated = await updateRequest(repository, request._id, {
      url: 'https://example.com/:id',
      body: { mimeType: 'application/octet-stream' },
    });

    expect(updated).toMatchObject({
      pathParameters: [{ name: 'id', value: '' }],
      body: { mimeType: 'application/octet-stream', fileName: '' },
    });
  });
});
