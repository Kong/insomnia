import type { Example, ExamplePatch, Request } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { META_SORT_KEY_GAP } from 'insomnia-data/common';
import { v4 as uuidv4 } from 'uuid';
import { beforeEach, describe, expect, it } from 'vitest';

const createRequestFixture = async () => {
  await services.settings.getOrCreate();

  const project = await services.project.create({
    _id: `proj_test_${uuidv4()}`,
    name: 'Test Project',
  });
  const workspace = await services.workspace.create({
    _id: `wrk_test_${uuidv4()}`,
    name: 'Test Workspace',
    parentId: project._id,
    scope: 'collection',
  });
  const request = (await services.request.create({
    _id: `req_test_${uuidv4()}`,
    name: 'Test Request',
    parentId: workspace._id,
    url: 'https://api.example.com/test',
    method: 'GET',
    metaSortKey: -1 * Date.now(),
  })) as Request;
  return { workspaceId: workspace._id, requestId: request._id };
};

describe('Example Service', () => {
  let workspaceId: string;
  let requestId: string;

  beforeEach(async () => {
    ({ workspaceId, requestId } = await createRequestFixture());
  });

  it('should create an example snapshot under a request', async () => {
    const example = await services.example.create({
      parentId: requestId,
      name: '200 OK',
      request: {
        method: 'POST',
        url: 'https://api.example.com/test',
        parameters: [],
        headers: [],
        body: {},
      },
      response: {
        statusCode: 200,
        statusMessage: 'OK',
        headers: [],
        body: '{"ok":true}',
      },
    });

    expect(example).toMatchObject({
      parentId: requestId,
      name: '200 OK',
      type: 'Example',
    });
    expect(example.request.url).toBe('https://api.example.com/test');
    expect(example.response.statusCode).toBe(200);
  });

  it('snapshots the User-Agent setting along with the request', async () => {
    const request = (await services.request.getById(requestId))!;
    await services.request.update(request, { disableUserAgentHeader: true });

    const example = await services.example.createFromRequest(requestId, { name: '200 OK' });

    expect(example.request.disableUserAgentHeader).toBe(true);
  });

  it('should fill the snapshot defaults when the caller omits them', async () => {
    const example = (await services.example.create({ parentId: requestId, name: 'Defaults' })) as Example;

    // The editors and the v5 export read every snapshot field, so a document
    // without them would throw on `.filter` / `.find`.
    expect(example.request).toEqual({
      method: 'GET',
      url: '',
      parameters: [],
      pathParameters: undefined,
      headers: [],
      body: {},
    });
    expect(example.response).toEqual({ statusCode: 200, statusMessage: '', headers: [], body: '' });
  });

  it('should duplicate an example with a (Copy) name and a metaSortKey between siblings', async () => {
    const first = (await services.example.create({
      parentId: requestId,
      name: '200 OK',
      metaSortKey: -200,
    })) as Example;
    const second = (await services.example.create({
      parentId: requestId,
      name: '404 Not Found',
      metaSortKey: -100,
    })) as Example;

    const duplicated = await services.example.duplicate(first);

    expect(duplicated._id).not.toBe(first._id);
    expect(duplicated.parentId).toBe(requestId);
    expect(duplicated.name).toBe('200 OK (Copy)');
    // The duplicate sorts right after the original
    expect(duplicated.metaSortKey).toBeGreaterThan(first.metaSortKey);
    expect(duplicated.metaSortKey).toBeLessThan(second.metaSortKey);
    expect(duplicated.request).toEqual(first.request);
    expect(duplicated.response).toEqual(first.response);

    const all = await services.example.listByParentIds(requestId);
    expect(all).toHaveLength(3);
    expect(all.find(e => e._id === duplicated._id)).toBeDefined();
  });

  it('should honor an explicit name when duplicating', async () => {
    const example = (await services.example.create({
      parentId: requestId,
      name: '200 OK',
      metaSortKey: -100,
    })) as Example;

    const duplicated = await services.example.duplicate(example, { name: 'Renamed copy' });

    expect(duplicated.name).toBe('Renamed copy');
    expect(duplicated.metaSortKey).toBeGreaterThan(example.metaSortKey);
  });

  it('should list examples by parent id', async () => {
    const otherRequest = (await services.request.create({
      _id: `req_test_${uuidv4()}`,
      name: 'Other Request',
      parentId: workspaceId,
      url: 'https://api.example.com/other',
      method: 'GET',
      metaSortKey: -1 * Date.now(),
    })) as Request;
    await services.example.create({ parentId: requestId, name: '200 OK', metaSortKey: -100 });
    await services.example.create({ parentId: otherRequest._id, name: 'Other', metaSortKey: -100 });

    expect(await services.example.listByParentIds(requestId)).toHaveLength(1);
    expect(await services.example.listByParentIds([requestId, otherRequest._id])).toHaveLength(2);
  });

  it('should refuse to attach an example to a non-request parent', async () => {
    await expect(services.example.create({ parentId: workspaceId, name: 'Orphan' })).rejects.toThrow(
      'Parent request not found',
    );
  });

  it('should refuse to create examples for GraphQL and event-stream requests', async () => {
    const graphqlRequest = (await services.request.create({
      _id: `req_test_${uuidv4()}`,
      name: 'GraphQL Request',
      parentId: workspaceId,
      url: 'https://api.example.com/graphql',
      method: 'POST',
      body: { mimeType: 'application/graphql', text: 'query { hello }' },
      metaSortKey: -1 * Date.now(),
    })) as Request;
    const sseRequest = (await services.request.create({
      _id: `req_test_${uuidv4()}`,
      name: 'SSE Request',
      parentId: workspaceId,
      url: 'https://api.example.com/events',
      method: 'GET',
      headers: [{ name: 'Accept', value: 'text/event-stream' }],
      metaSortKey: -1 * Date.now(),
    })) as Request;

    await expect(services.example.create({ parentId: graphqlRequest._id, name: 'GQL' })).rejects.toThrow(
      'plain HTTP requests',
    );
    await expect(services.example.create({ parentId: sseRequest._id, name: 'SSE' })).rejects.toThrow(
      'plain HTTP requests',
    );
  });

  it('should keep an empty name when duplicating an unnamed example', async () => {
    const example = (await services.example.create({
      parentId: requestId,
      // No name — the duplicate must not inherit the model's display name.
      name: '',
      metaSortKey: -100,
    })) as Example;

    const duplicated = await services.example.duplicate(example);

    expect(duplicated.name).toBe('');
  });

  it('should place a duplicate after the last sibling when duplicating the final example', async () => {
    const first = (await services.example.create({
      parentId: requestId,
      name: '200 OK',
      metaSortKey: -200,
    })) as Example;
    const last = (await services.example.create({
      parentId: requestId,
      name: '404 Not Found',
      metaSortKey: -100,
    })) as Example;

    const duplicated = await services.example.duplicate(last);

    // No sibling after the original: the copy extends one gap past it, the same
    // rule the sidebar's drag-and-drop uses at the section edge.
    expect(duplicated.metaSortKey).toBe(last.metaSortKey + META_SORT_KEY_GAP);
    expect(duplicated.metaSortKey).toBeGreaterThan(first.metaSortKey);
  });

  it('should reject a response body over the size limit on create', async () => {
    const oversizedBody = 'x'.repeat(models.example.MAX_EXAMPLE_RESPONSE_BODY_BYTES + 1);

    await expect(
      services.example.create({
        parentId: requestId,
        name: 'Huge',
        response: { statusCode: 200, statusMessage: '', headers: [], body: oversizedBody },
      }),
    ).rejects.toThrow('the limit is 1 MB');
    expect(await services.example.listByParentIds(requestId)).toHaveLength(0);
  });

  it('should cascade-delete examples when the parent request is removed', async () => {
    const example = (await services.example.create({
      parentId: requestId,
      name: '200 OK',
      metaSortKey: -100,
    })) as Example;

    await services.request.remove((await services.request.getById(requestId))!);

    expect(await services.request.getById(requestId)).toBeUndefined();
    expect(await services.example.getById(example._id)).toBeUndefined();
    expect(await services.example.listByParentIds(requestId)).toHaveLength(0);
  });
});

describe('Example Service validated write paths', () => {
  let workspaceId: string;
  let requestId: string;

  beforeEach(async () => {
    ({ workspaceId, requestId } = await createRequestFixture());
  });

  const setupExample = async () => {
    const example = (await services.example.create({
      parentId: requestId,
      name: '200 OK',
      description: 'original',
      metaSortKey: -100,
      request: {
        method: 'GET',
        url: 'https://example.com',
        parameters: [],
        headers: [],
        body: {},
      },
      response: {
        statusCode: 200,
        statusMessage: 'OK',
        headers: [],
        body: 'hello',
      },
    })) as Example;
    return example;
  };

  describe('update', () => {
    it('updates whitelisted fields', async () => {
      const example = await setupExample();

      await services.example.update(example._id, {
        name: 'Renamed',
        description: 'updated',
        metaSortKey: -50,
      });

      await expect(services.example.getById(example._id)).resolves.toMatchObject({
        name: 'Renamed',
        description: 'updated',
        metaSortKey: -50,
      });
    });

    it('strips identity fields from the patch', async () => {
      const example = await setupExample();

      await services.example.update(
        example._id,
        // Deliberately malformed client input: identity/shape fields a real
        // caller could try to smuggle through the IPC boundary.
        {
          _id: 'exp_forged',
          parentId: 'req_other',
          type: 'Workspace',
          name: 'Renamed',
        } as unknown as ExamplePatch,
      );

      const updated = await services.example.getById(example._id);
      expect(updated).toMatchObject({
        _id: example._id,
        parentId: requestId,
        type: 'Example',
        name: 'Renamed',
      });
    });

    it('rejects a non-number response.statusCode', async () => {
      const example = await setupExample();

      await expect(services.example.update(example._id, {
        response: { statusCode: 'not-a-number' as unknown as number },
      })).rejects.toThrow('statusCode');
      await expect(services.example.getById(example._id)).resolves.toMatchObject({
        response: expect.objectContaining({ statusCode: 200 }),
      });
    });

    it('rejects a NaN response.statusCode', async () => {
      // NaN survives IPC structured clone (unlike the old JSON path, which
      // turned it into null) and would otherwise be persisted verbatim.
      const example = await setupExample();

      await expect(services.example.update(example._id, {
        response: { statusCode: Number.NaN },
      })).rejects.toThrow('statusCode');
      await expect(services.example.getById(example._id)).resolves.toMatchObject({
        response: expect.objectContaining({ statusCode: 200 }),
      });
    });

    it('rejects a response body over the size limit and keeps the stored body', async () => {
      const example = await setupExample();

      await expect(services.example.update(example._id, {
        response: { body: 'y'.repeat(models.example.MAX_EXAMPLE_RESPONSE_BODY_BYTES + 1) },
      })).rejects.toThrow('the limit is 1 MB');
      await expect(services.example.getById(example._id)).resolves.toMatchObject({
        response: expect.objectContaining({ body: 'hello' }),
      });
    });

    it('shallow-merges request/response patches without clobbering sibling keys', async () => {
      const example = await setupExample();

      await services.example.update(example._id, { request: { url: 'https://example.com/patched' } });
      await services.example.update(example._id, { response: { body: 'new body' } });

      const updated = await services.example.getById(example._id);
      // The second (response-only) patch must not roll the request snapshot back
      expect(updated).toMatchObject({
        request: expect.objectContaining({ method: 'GET', url: 'https://example.com/patched' }),
        response: expect.objectContaining({ statusCode: 200, body: 'new body' }),
      });
    });

    it('throws when the example does not exist', async () => {
      await expect(services.example.update('exp_missing', { name: 'X' })).rejects.toThrow('not found');
    });
  });

  describe('remove', () => {
    it('removes the example', async () => {
      const example = await setupExample();

      await services.example.remove(example._id);

      await expect(services.example.getById(example._id)).resolves.toBeUndefined();
    });

    it('throws when the example does not exist', async () => {
      await expect(services.example.remove('exp_missing')).rejects.toThrow('not found');
    });
  });

  describe('duplicate', () => {
    it('duplicates the example under the same request', async () => {
      const example = await setupExample();

      const duplicated = await services.example.duplicate(example._id, { name: 'My Copy' });

      expect(duplicated).toMatchObject({ parentId: requestId, name: 'My Copy' });
      expect(await services.example.listByParentIds(requestId)).toHaveLength(2);
    });

    it('throws when the example does not exist', async () => {
      await expect(services.example.duplicate('exp_missing', {})).rejects.toThrow('not found');
    });

    it('does not let the patch override the placement fields', async () => {
      const first = (await services.example.create({
        parentId: requestId,
        name: '200 OK',
        metaSortKey: -200,
      })) as Example;
      await services.example.create({
        parentId: requestId,
        name: '404 Not Found',
        metaSortKey: -100,
      });

      // Even if a caller smuggles placement fields into the patch, the copy
      // must stay under its parent, right after the original.
      const duplicated = await services.example.duplicate(first._id, {
        name: 'My Copy',
        metaSortKey: 999_999,
        parentId: 'req_other',
      } as { name?: string });

      expect(duplicated.parentId).toBe(requestId);
      expect(duplicated.metaSortKey).toBeGreaterThan(first.metaSortKey);
      expect(duplicated.metaSortKey).toBeLessThan(-100);
      expect(duplicated.name).toBe('My Copy');
    });
  });

  describe('createFromRequest', () => {
    it('snapshots the parent request and applies payload overrides', async () => {
      const example = (await services.example.createFromRequest(requestId, {
        name: '200 OK',
        response: { statusCode: 200, statusMessage: 'OK', headers: [], body: 'hello' },
      })) as Example;

      expect(example).toMatchObject({
        parentId: requestId,
        name: '200 OK',
        request: expect.objectContaining({ method: 'GET', url: 'https://api.example.com/test' }),
        response: expect.objectContaining({ statusCode: 200, body: 'hello' }),
      });
    });

    it('defaults the response snapshot when the payload omits it', async () => {
      const example = (await services.example.createFromRequest(requestId, { name: 'Example' })) as Example;

      expect(example.response).toEqual({ statusCode: 200, statusMessage: '', headers: [], body: '' });
    });

    it('keeps the isPrivate flag and inherits it from the parent request', async () => {
      const publicExample = (await services.example.createFromRequest(requestId, { name: 'Public' })) as Example;
      expect(publicExample.isPrivate).toBe(false);

      const request = await services.request.getById(requestId);
      await services.request.update(request!, { isPrivate: true });

      const privateExample = (await services.example.createFromRequest(requestId, { name: 'Private' })) as Example;
      // The flag must survive `initModel`, or canSync's private check never sees it.
      expect((await services.example.getById(privateExample._id))?.isPrivate).toBe(true);
    });

    it('rejects a non-HTTP request id', async () => {
      // gRPC requests live in their own bucket, so the HTTP request lookup
      // cannot resolve them and the service must refuse to create an example.
      const grpcRequest = await services.grpcRequest.create({
        name: 'gRPC',
        parentId: workspaceId,
        url: 'grpc.url',
        protoMethodName: '',
      });

      await expect(services.example.createFromRequest(grpcRequest._id, { name: 'X' }))
        .rejects.toThrow();
      expect(await services.example.listByParentIds(grpcRequest._id)).toHaveLength(0);
    });

 });
});
