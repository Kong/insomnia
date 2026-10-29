import type { Example, ExamplePatch, ExampleRequest, Request } from 'insomnia-data';
import { services } from 'insomnia-data';
import { v4 as uuidv4 } from 'uuid';
import { beforeEach, describe, expect, it } from 'vitest';

// @vitest-environment jsdom
describe('Example Service', () => {
  let workspaceId: string;
  let requestId: string;

  beforeEach(async () => {
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
    workspaceId = workspace._id;
    requestId = request._id;
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

    // No sibling after the original: the fallback boundary is
    // last.metaSortKey + 100, halved into a midpoint (+50).
    expect(duplicated.metaSortKey).toBe(last.metaSortKey + 50);
    expect(duplicated.metaSortKey).toBeGreaterThan(first.metaSortKey);
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
    workspaceId = workspace._id;
    requestId = request._id;
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
      }, requestId);

      await expect(services.example.getById(example._id)).resolves.toMatchObject({
        name: 'Renamed',
        description: 'updated',
        metaSortKey: -50,
      });
    });

    it('rejects when the example does not belong to the expected parent', async () => {
      const example = await setupExample();

      await expect(services.example.update(example._id, { name: 'Hijacked' }, 'req_other'))
        .rejects.toThrow('does not belong');
      await expect(services.example.getById(example._id)).resolves.toMatchObject({ name: '200 OK' });
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
        requestId,
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
      }, requestId)).rejects.toThrow('statusCode');
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
      }, requestId)).rejects.toThrow('statusCode');
      await expect(services.example.getById(example._id)).resolves.toMatchObject({
        response: expect.objectContaining({ statusCode: 200 }),
      });
    });

    it('shallow-merges request/response patches without clobbering sibling keys', async () => {
      const example = await setupExample();

      await services.example.update(example._id, { request: { url: 'https://example.com/patched' } }, requestId);
      await services.example.update(example._id, { response: { body: 'new body' } }, requestId);

      const updated = await services.example.getById(example._id);
      // The second (response-only) patch must not roll the request snapshot back
      expect(updated).toMatchObject({
        request: expect.objectContaining({ method: 'GET', url: 'https://example.com/patched' }),
        response: expect.objectContaining({ statusCode: 200, body: 'new body' }),
      });
    });

    it('throws when the example does not exist', async () => {
      await expect(services.example.update('exp_missing', { name: 'X' }, requestId)).rejects.toThrow('not found');
    });
  });

  describe('remove', () => {
    it('removes the example', async () => {
      const example = await setupExample();

      await services.example.remove(example._id, requestId);

      await expect(services.example.getById(example._id)).resolves.toBeUndefined();
    });

    it('throws when the example does not belong to the expected parent', async () => {
      const example = await setupExample();

      await expect(services.example.remove(example._id, 'req_other')).rejects.toThrow('does not belong');
      await expect(services.example.getById(example._id)).resolves.toBeDefined();
    });

    it('throws when the example does not exist', async () => {
      await expect(services.example.remove('exp_missing', requestId)).rejects.toThrow('not found');
    });
  });

  describe('duplicate', () => {
    it('duplicates the example under the same request', async () => {
      const example = await setupExample();

      const duplicated = await services.example.duplicate(example._id, { name: 'My Copy' }, requestId);

      expect(duplicated).toMatchObject({ parentId: requestId, name: 'My Copy' });
      expect(await services.example.listByParentIds(requestId)).toHaveLength(2);
    });

    it('throws when the example does not belong to the expected parent', async () => {
      const example = await setupExample();

      await expect(services.example.duplicate(example._id, {}, 'req_other')).rejects.toThrow('does not belong');
      expect(await services.example.listByParentIds(requestId)).toHaveLength(1);
    });

    it('throws when the example does not exist', async () => {
      await expect(services.example.duplicate('exp_missing', {}, requestId)).rejects.toThrow('not found');
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
      } as { name?: string }, requestId);

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

    it('rejects a non-HTTP request id', async () => {
      // gRPC requests live in their own bucket, so the HTTP request lookup
      // cannot resolve them and the service must refuse to create an example.
      const grpcRequest = await services.grpcRequest.create({
        name: 'gRPC',
        parentId: workspaceId,
        url: 'grpc.url',
        protoMethodName: '',
      });

      await expect(services.example.createFromRequest(grpcRequest._id, { name: 'X' }, workspaceId))
        .rejects.toThrow();
      expect(await services.example.listByParentIds(grpcRequest._id)).toHaveLength(0);
    });

    it('rejects a request that lives under a different workspace', async () => {
      const project = await services.project.create({ _id: `proj_test_${uuidv4()}`, name: 'Other Project' });
      const otherWorkspace = await services.workspace.create({
        _id: `wrk_test_${uuidv4()}`,
        name: 'Other Workspace',
        parentId: project._id,
        scope: 'collection',
      });

      await expect(services.example.createFromRequest(requestId, { name: 'X' }, otherWorkspace._id))
        .rejects.toThrow('workspace');
    });

    it('throws when the request does not exist', async () => {
      await expect(services.example.createFromRequest('req_missing', { name: 'X' }, workspaceId))
        .rejects.toThrow('Request not found');
    });
  });
});

describe('Request Service createFromExample', () => {
  let workspaceId: string;
  let requestId: string;

  beforeEach(async () => {
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
    workspaceId = workspace._id;
    requestId = request._id;
  });

  it('creates a request from the example right after its parent', async () => {
    const example = (await services.example.create({
      parentId: requestId,
      name: '200 OK',
      description: 'promoted',
      metaSortKey: -100,
      request: {
        method: 'POST',
        url: 'https://example.com/promoted',
        parameters: [],
        headers: [],
        body: {},
      } satisfies Partial<ExampleRequest>,
    })) as Example;

    // A sibling request after the parent gives the placement something to
    // fall between: parent < created < next sibling.
    const parentRequest = (await services.request.getById(requestId))!;
    const nextSibling = (await services.request.create({
      name: 'Next Request',
      parentId: workspaceId,
      url: 'r2.url',
      metaSortKey: parentRequest.metaSortKey + 100,
    })) as Request;

    const created = await services.request.createFromExample(example._id, requestId);

    expect(created).toMatchObject({
      parentId: workspaceId,
      name: '200 OK',
      description: 'promoted',
      method: 'POST',
      url: 'https://example.com/promoted',
    });
    expect(created.metaSortKey).toBeGreaterThan(parentRequest.metaSortKey);
    expect(created.metaSortKey).toBeLessThan(nextSibling.metaSortKey);
  });

  it('places the created request after the parent when there is no later sibling', async () => {
    const example = (await services.example.create({
      parentId: requestId,
      name: '200 OK',
      metaSortKey: -100,
    })) as Example;

    const parentRequest = (await services.request.getById(requestId))!;
    const created = await services.request.createFromExample(example._id, requestId);

    // No sibling after the parent: the fallback boundary is
    // parent.metaSortKey + 100, halved into a midpoint (+50).
    expect(created.metaSortKey).toBe(parentRequest.metaSortKey + 50);
  });

  it('falls back to the parent request name when the example is unnamed', async () => {
    const example = (await services.example.create({ parentId: requestId, name: '', metaSortKey: -100 })) as Example;

    const created = await services.request.createFromExample(example._id, requestId);

    expect(created.name).toBe('Test Request');
  });

  it('throws when the example does not belong to the expected parent', async () => {
    const example = (await services.example.create({ parentId: requestId, name: 'X', metaSortKey: -100 })) as Example;

    await expect(services.request.createFromExample(example._id, 'req_other')).rejects.toThrow('does not belong');
  });

  it('throws when the example does not exist', async () => {
    await expect(services.request.createFromExample('exp_missing', requestId)).rejects.toThrow('not found');
  });
});
