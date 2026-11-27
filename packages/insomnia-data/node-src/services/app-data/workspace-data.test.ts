import { database, models } from 'insomnia-data';
import { CONTENT_TYPE_GRAPHQL } from 'insomnia-data/common';
import { servicesNodeImpl } from 'insomnia-data/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAllCollectionChildrenAndMetasByWorkspaceIds, getAllDesignChildrenByWorkspaceIds } from './workspace-data';

describe('getAllCollectionChildrenAndMetasByWorkspaceIds', () => {
  beforeEach(async () => {
    await database.init({ inMemoryOnly: true }, true);
  });

  it('walks nested request groups and collects their requests', async () => {
    const workspace = await servicesNodeImpl.workspace.create({ scope: 'collection' });
    const folder = await servicesNodeImpl.requestGroup.create({ parentId: workspace._id, name: 'folder' });
    const subfolder = await servicesNodeImpl.requestGroup.create({ parentId: folder._id, name: 'subfolder' });
    const request = await servicesNodeImpl.request.create({ parentId: subfolder._id, name: 'req' });

    const result = await getAllCollectionChildrenAndMetasByWorkspaceIds([workspace._id]);

    const ids = result.get(workspace._id)!.data.requestsAndGroups.map(doc => doc._id);
    expect(ids.sort()).toEqual([folder._id, request._id, subfolder._id].sort());
  });

  it('attaches example summaries to the workspace of their parent request', async () => {
    const workspace = await servicesNodeImpl.workspace.create({ scope: 'collection' });
    const request = await servicesNodeImpl.request.create({ parentId: workspace._id, name: 'req' });
    const example = await servicesNodeImpl.example.create({
      parentId: request._id,
      name: '200 OK',
      response: { statusCode: 201, statusMessage: 'Created', headers: [], body: '{"ok":true}' },
    });

    const result = await getAllCollectionChildrenAndMetasByWorkspaceIds([workspace._id]);

    expect(result.get(workspace._id)!.data.examples).toEqual([
      {
        _id: example._id,
        parentId: request._id,
        type: 'Example',
        name: '200 OK',
        description: '',
        metaSortKey: example.metaSortKey,
        modified: example.modified,
        created: example.created,
        isPrivate: example.isPrivate,
        request: { method: 'GET' },
        response: { statusCode: 201 },
      },
    ]);
  });

  it('leaves out examples whose parent request can no longer host them', async () => {
    const workspace = await servicesNodeImpl.workspace.create({ scope: 'collection' });
    const request = await servicesNodeImpl.request.create({ parentId: workspace._id, name: 'req' });
    await servicesNodeImpl.example.create({ parentId: request._id, name: '200 OK' });

    // Switching the request to GraphQL keeps the example locally but stops it
    // from being listed, exported and synced.
    await servicesNodeImpl.request.update(request, { body: { mimeType: CONTENT_TYPE_GRAPHQL } });

    const result = await getAllCollectionChildrenAndMetasByWorkspaceIds([workspace._id]);

    expect(result.get(workspace._id)!.data.examples).toEqual([]);
  });

  it('reads examples through the summary projection, so their bodies never load', async () => {
    const workspace = await servicesNodeImpl.workspace.create({ scope: 'collection' });
    const request = await servicesNodeImpl.request.create({ parentId: workspace._id, name: 'req' });
    await servicesNodeImpl.example.create({
      parentId: request._id,
      name: '200 OK',
      response: { statusCode: 200, statusMessage: 'OK', headers: [], body: 'x'.repeat(200 * 1024) },
    });

    const findSpy = vi.spyOn(database, 'find');
    let exampleRead: (typeof findSpy.mock.calls)[number] | undefined;
    try {
      await getAllCollectionChildrenAndMetasByWorkspaceIds([workspace._id]);
      // Read the calls before `mockRestore()`, which clears them.
      exampleRead = findSpy.mock.calls.find(([type]) => type === models.example.type);
    } finally {
      findSpy.mockRestore();
    }

    // Without the projection the read deserialises every example body (up to
    // 1 MB each) only for `toExampleSummary` to throw it away.
    expect(exampleRead?.[4]).toBe(models.example.exampleSummaryProjection);
  });

  it('includes the workspace api spec', async () => {
    const workspace = await servicesNodeImpl.workspace.create({ scope: 'design' });
    const apiSpec = await servicesNodeImpl.apiSpec.getOrCreateForParentId(workspace._id, { contents: 'openapi: 3.0.0' });

    const result = await getAllCollectionChildrenAndMetasByWorkspaceIds([workspace._id]);

    expect(result.get(workspace._id)!.data.apiSpec?._id).toBe(apiSpec._id);
    expect(result.get(workspace._id)!.data.apiSpec?.contents).toBe('openapi: 3.0.0');
  });

  it('leaves apiSpec undefined for a workspace without an api spec', async () => {
    const workspace = await servicesNodeImpl.workspace.create({ scope: 'collection' });

    const result = await getAllCollectionChildrenAndMetasByWorkspaceIds([workspace._id]);

    expect(result.get(workspace._id)!.data.apiSpec).toBeUndefined();
  });

  it('attaches each api spec to its own workspace and ignores specs of workspaces that were not requested', async () => {
    const workspaceA = await servicesNodeImpl.workspace.create({ scope: 'design' });
    const workspaceB = await servicesNodeImpl.workspace.create({ scope: 'design' });
    const workspaceC = await servicesNodeImpl.workspace.create({ scope: 'design' });
    const specA = await servicesNodeImpl.apiSpec.getOrCreateForParentId(workspaceA._id, { contents: 'a' });
    const specB = await servicesNodeImpl.apiSpec.getOrCreateForParentId(workspaceB._id, { contents: 'b' });
    await servicesNodeImpl.apiSpec.getOrCreateForParentId(workspaceC._id, { contents: 'c' });

    const result = await getAllCollectionChildrenAndMetasByWorkspaceIds([workspaceA._id, workspaceB._id]);

    expect(result.get(workspaceA._id)!.data.apiSpec?._id).toBe(specA._id);
    expect(result.get(workspaceB._id)!.data.apiSpec?._id).toBe(specB._id);
    expect(result.has(workspaceC._id)).toBe(false);
  });
});

describe('getAllDesignChildrenByWorkspaceIds', () => {
  beforeEach(async () => {
    await database.init({ inMemoryOnly: true }, true);
  });

  it('returns the api spec together with the requests and groups of each design workspace', async () => {
    const workspace = await servicesNodeImpl.workspace.create({ scope: 'design' });
    const apiSpec = await servicesNodeImpl.apiSpec.getOrCreateForParentId(workspace._id, { contents: 'openapi: 3.0.0' });
    const request = await servicesNodeImpl.request.create({ parentId: workspace._id, name: 'req' });

    const result = await getAllDesignChildrenByWorkspaceIds([workspace._id]);

    const children = result.get(workspace._id)!;
    expect(children.data.apiSpec?._id).toBe(apiSpec._id);
    expect(children.data.requestsAndGroups.map(doc => doc._id)).toEqual([request._id]);
  });

  it('returns an undefined api spec and empty lists for a workspace without any children', async () => {
    const workspace = await servicesNodeImpl.workspace.create({ scope: 'design' });

    const result = await getAllDesignChildrenByWorkspaceIds([workspace._id]);

    expect(result.get(workspace._id)).toEqual({
      data: { apiSpec: undefined, requestsAndGroups: [], examples: [] },
      dataMetas: { allRequestMetas: [], requestGroupMetas: [] },
    });
  });

  it('returns an empty map when no workspace ids are given', async () => {
    expect((await getAllDesignChildrenByWorkspaceIds([])).size).toBe(0);
  });
});
