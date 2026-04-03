import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';

import { services } from '~/insomnia-data';

import type { BaseModel } from '../../../models';
import * as models from '../../../models';
import type { ChangeBufferEvent } from '../..';
import { database as db } from '../..';
import { repairDatabase } from './repair-database';

describe('init()', () => {
  it('handles being initialized twice', async () => {
    await db.init({
      inMemoryOnly: true,
    });
    await db.init({
      inMemoryOnly: true,
    });
    expect((await db.find(models.request.type)).length).toBe(0);
  });
});

describe('onChange()', () => {
  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
  });
  it('handles change listeners', async () => {
    const doc = {
      type: models.request.type,
      parentId: 'nothing',
      name: 'foo',
    };
    const changesSeen: ChangeBufferEvent<BaseModel>[] = [];

    const callback = change => {
      changesSeen.push(change);
    };

    db.onChange(callback);
    const newDoc = await models.request.create(doc);
    const updatedDoc = await models.request.update(newDoc, {
      name: 'bar',
    });
    expect(changesSeen).toEqual([[['insert', newDoc, []]], [['update', updatedDoc, [{ name: 'bar' }]]]]);
  });
});

describe('bufferChanges()', () => {
  it('properly buffers changes', async () => {
    const doc = {
      type: models.request.type,
      parentId: 'n/a',
      name: 'foo',
    };
    const changesSeen: ChangeBufferEvent<BaseModel>[] = [];

    const callback = change => {
      changesSeen.push(change);
    };

    db.onChange(callback);
    await db.bufferChanges();
    const newDoc = await models.request.create(doc);
    // @ts-expect-error -- TSCONVERSION appears to be genuine
    const updatedDoc = await models.request.update(newDoc);
    // Assert no change seen before flush
    expect(changesSeen.length).toBe(0);
    // Assert changes seen after flush
    await db.flushChanges();
    expect(changesSeen).toEqual([
      [
        ['insert', newDoc, []],
        ['update', updatedDoc, [undefined]],
      ],
    ]);
    // Assert no more changes seen after flush again
    await db.flushChanges();
    expect(changesSeen).toEqual([
      [
        ['insert', newDoc, []],
        ['update', updatedDoc, [undefined]],
      ],
    ]);
  });

  it('should auto flush after a default wait', async () => {
    const doc = {
      type: models.request.type,
      parentId: 'n/a',
      name: 'foo',
    };
    const changesSeen: ChangeBufferEvent<BaseModel>[] = [];

    const callback = change => {
      changesSeen.push(change);
    };

    db.onChange(callback);
    await db.bufferChanges();
    const newDoc = await models.request.create(doc);
    // @ts-expect-error -- TSCONVERSION appears to be genuine
    const updatedDoc = await models.request.update(newDoc);
    // Default flush timeout is 1000ms after starting buffering
    await new Promise(resolve => setTimeout(resolve, 1500));
    expect(changesSeen).toEqual([
      [
        ['insert', newDoc, []],
        ['update', updatedDoc, [undefined]],
      ],
    ]);
  });

  it('should auto flush after a specified wait', async () => {
    const doc = {
      type: models.request.type,
      parentId: 'n/a',
      name: 'foo',
    };
    const changesSeen: ChangeBufferEvent<BaseModel>[] = [];

    const callback = change => {
      changesSeen.push(change);
    };

    db.onChange(callback);
    await db.bufferChanges(500);
    const newDoc = await models.request.create(doc);
    // @ts-expect-error -- TSCONVERSION appears to be genuine
    const updatedDoc = await models.request.update(newDoc);
    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(changesSeen).toEqual([
      [
        ['insert', newDoc, []],
        ['update', updatedDoc, [undefined]],
      ],
    ]);
  });
});

describe('bufferChangesIndefinitely()', () => {
  it('should not auto flush', async () => {
    const doc = {
      type: models.request.type,
      parentId: 'n/a',
      name: 'foo',
    };
    const changesSeen: ChangeBufferEvent<BaseModel>[] = [];

    const callback = change => {
      changesSeen.push(change);
    };

    db.onChange(callback);
    await db.bufferChangesIndefinitely();
    const newDoc = await models.request.create(doc);
    // @ts-expect-error -- TSCONVERSION appears to be genuine
    const updatedDoc = await models.request.update(newDoc);
    // Default flush timeout is 1000ms after starting buffering
    await new Promise(resolve => setTimeout(resolve, 1500));
    // Assert no change seen before flush
    expect(changesSeen.length).toBe(0);
    // Assert changes seen after flush
    await db.flushChanges();
    expect(changesSeen).toEqual([
      [
        ['insert', newDoc, []],
        ['update', updatedDoc, [undefined]],
      ],
    ]);
  });
});

describe('requestCreate()', () => {
  it('creates a valid request', async () => {
    const now = Date.now();
    const patch = {
      name: 'My Request',
      parentId: 'wrk_123',
    };
    const r = await models.request.create(patch);
    expect(Object.keys(r).length).toBe(24);
    expect(r._id).toMatch(/^req_[a-zA-Z0-9]{32}$/);
    expect(r.created).toBeGreaterThanOrEqual(now);
    expect(r.modified).toBeGreaterThanOrEqual(now);
    expect(r.type).toBe('Request');
    expect(r.name).toBe('My Request');
    expect(r.url).toBe('');
    expect(r.method).toBe('GET');
    expect(r.body).toEqual({});
    expect(r.parameters).toEqual([]);
    expect(r.headers).toEqual([]);
    expect(r.authentication).toEqual({});
    expect(r.metaSortKey).toBeLessThanOrEqual(-1 * now);
    expect(r.parentId).toBe('wrk_123');
  });

  it('throws when missing parentID', () => {
    const fn = () =>
      models.request.create({
        name: 'My Request',
      });

    expect(fn).toThrowError('New Requests missing `parentId`');
  });
});

describe('_repairDatabase()', async () => {
  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
  });

  it('fixes duplicate environments', async () => {
    // Create Workspace with no children
    const project = await models.project.create();
    const workspace = await models.workspace.create({
      _id: 'w1',
      parentId: project._id,
    });
    // Create one set of sub environments
    await models.environment.create({
      _id: 'b1',
      parentId: 'w1',
      data: {
        foo: 'b1',
        b1: true,
      },
    });
    await models.environment.create({
      _id: 'b1_sub1',
      parentId: 'b1',
      data: {
        foo: '1',
      },
    });
    await models.environment.create({
      _id: 'b1_sub2',
      parentId: 'b1',
      data: {
        foo: '2',
      },
    });
    // Create second set of sub environments
    await models.environment.create({
      _id: 'b2',
      parentId: 'w1',
      data: {
        foo: 'b2',
        b2: true,
      },
    });
    await models.environment.create({
      _id: 'b2_sub1',
      parentId: 'b2',
      data: {
        foo: '3',
      },
    });
    await models.environment.create({
      _id: 'b2_sub2',
      parentId: 'b2',
      data: {
        foo: '4',
      },
    });
    // Make sure we have 6 environments and one workspace
    expect((await db.getWithDescendants(workspace)).length).toBe(7);
    const descendants = (await db.getWithDescendants(workspace)).map(d => ({
      _id: d._id,
      parentId: d.parentId,
      data: d.data || null,
    }));
    expect(descendants).toEqual([
      {
        _id: 'w1',
        data: null,
        parentId: workspace.parentId,
      },
      {
        _id: 'b1',
        data: {
          foo: 'b1',
          b1: true,
        },
        parentId: 'w1',
      },
      {
        _id: 'b2',
        data: {
          foo: 'b2',
          b2: true,
        },
        parentId: 'w1',
      },
      {
        _id: 'b1_sub1',
        data: {
          foo: '1',
        },
        parentId: 'b1',
      },
      {
        _id: 'b1_sub2',
        data: {
          foo: '2',
        },
        parentId: 'b1',
      },
      {
        _id: 'b2_sub1',
        data: {
          foo: '3',
        },
        parentId: 'b2',
      },
      {
        _id: 'b2_sub2',
        data: {
          foo: '4',
        },
        parentId: 'b2',
      },
    ]);

    // Run the fix algorithm
    await repairDatabase();

    // Make sure things get adjusted
    const descendants2 = (await db.getWithDescendants(workspace)).map(d => ({
      _id: d._id,
      parentId: d.parentId,
      data: d.data || null,
    }));
    expect(descendants2).toEqual([
      {
        _id: 'w1',
        data: null,
        parentId: workspace.parentId,
      },
      {
        _id: 'b1',
        data: {
          foo: 'b1',
          b1: true,
          b2: true,
        },
        parentId: 'w1',
      },
      // Extra base environments should have been deleted
      // {_id: 'b2', data: {foo: 'bar'}, parentId: 'w1'},
      // Sub environments should have been moved to new "master" base environment
      {
        _id: 'b1_sub1',
        data: {
          foo: '1',
        },
        parentId: 'b1',
      },
      {
        _id: 'b1_sub2',
        data: {
          foo: '2',
        },
        parentId: 'b1',
      },
      {
        _id: 'b2_sub1',
        data: {
          foo: '3',
        },
        parentId: 'b1',
      },
      {
        _id: 'b2_sub2',
        data: {
          foo: '4',
        },
        parentId: 'b1',
      },
    ]);
  });

  it('fixes duplicate cookie jars', async () => {
    // Create Workspace with no children
    const project = await models.project.create();
    const workspace = await models.workspace.create({
      _id: 'w1',
      parentId: project._id,
    });
    expect((await db.getWithDescendants(workspace)).length).toBe(1);
    // Create one set of sub environments
    await models.cookieJar.create({
      _id: 'j1',
      parentId: 'w1',
      cookies: [
        // @ts-expect-error -- TSCONVERSION
        {
          id: '1',
          key: 'foo',
          value: '1',
        },
        // @ts-expect-error -- TSCONVERSION
        {
          id: 'j1_1',
          key: 'j1',
          value: '1',
        },
      ],
    });
    await models.cookieJar.create({
      _id: 'j2',
      parentId: 'w1',
      cookies: [
        // @ts-expect-error -- TSCONVERSION
        {
          id: '1',
          key: 'foo',
          value: '2',
        },
        // @ts-expect-error -- TSCONVERSION
        {
          id: 'j2_1',
          key: 'j2',
          value: '2',
        },
      ],
    });
    // Make sure we have 2 cookie jars and one workspace
    expect((await db.getWithDescendants(workspace)).length).toBe(3);
    const descendants = (await db.getWithDescendants(workspace)).map(d => ({
      _id: d._id,
      cookies: d.cookies || null,
      parentId: d.parentId,
    }));
    expect(descendants).toEqual([
      {
        _id: 'w1',
        cookies: null,
        parentId: workspace.parentId,
      },
      {
        _id: 'j1',
        parentId: 'w1',
        cookies: [
          {
            id: '1',
            key: 'foo',
            value: '1',
          },
          {
            id: 'j1_1',
            key: 'j1',
            value: '1',
          },
        ],
      },
      {
        _id: 'j2',
        parentId: 'w1',
        cookies: [
          {
            id: '1',
            key: 'foo',
            value: '2',
          },
          {
            id: 'j2_1',
            key: 'j2',
            value: '2',
          },
        ],
      },
    ]);
    // Run the fix algorithm
    await repairDatabase();
    // Make sure things get adjusted
    const descendants2 = (await db.getWithDescendants(workspace)).map(d => ({
      _id: d._id,
      cookies: d.cookies || null,
      parentId: d.parentId,
    }));
    expect(descendants2).toEqual([
      {
        _id: 'w1',
        cookies: null,
        parentId: workspace.parentId,
      },
      {
        _id: 'j1',
        parentId: 'w1',
        cookies: [
          {
            id: '1',
            key: 'foo',
            value: '1',
          },
          {
            id: 'j1_1',
            key: 'j1',
            value: '1',
          },
          {
            id: 'j2_1',
            key: 'j2',
            value: '2',
          },
        ],
      },
    ]);
  });

  it('fixes the filename on an apiSpec', async () => {
    // Create Workspace with apiSpec child (migration in workspace will automatically create this as it is not mocked)
    const w1 = await models.workspace.create({
      _id: 'w1',
      name: 'Workspace 1',
    });
    const w2 = await models.workspace.create({
      _id: 'w2',
      name: 'Workspace 2',
    });
    const w3 = await models.workspace.create({
      _id: 'w3',
      name: 'Workspace 3',
    });
    await services.apiSpec.updateOrCreateForParentId(w1._id, {
      fileName: '',
    });
    await services.apiSpec.updateOrCreateForParentId(w2._id, {
      fileName: models.apiSpec.init().fileName,
    });
    await services.apiSpec.updateOrCreateForParentId(w3._id, {
      fileName: 'Unique name',
    });
    // Make sure we have everything
    expect((await services.apiSpec.getByParentId(w1._id))?.fileName).toBe('');
    expect((await services.apiSpec.getByParentId(w2._id))?.fileName).toBe('New Document');
    expect((await services.apiSpec.getByParentId(w3._id))?.fileName).toBe('Unique name');
    // Run the fix algorithm
    await repairDatabase();
    // Make sure things get adjusted
    expect((await services.apiSpec.getByParentId(w1._id))?.fileName).toBe('Workspace 1'); // Should fix
    expect((await services.apiSpec.getByParentId(w2._id))?.fileName).toBe('Workspace 2'); // Should fix
    expect((await services.apiSpec.getByParentId(w3._id))?.fileName).toBe('Unique name'); // should not fix
  });

  it('fixes old git uris', async () => {
    const oldRepoWithSuffix = await services.gitRepository.create({
      uri: 'https://github.com/foo/bar.git',
      uriNeedsMigration: true,
    });
    const oldRepoWithoutSuffix = await services.gitRepository.create({
      uri: 'https://github.com/foo/bar',
      uriNeedsMigration: true,
    });
    const newRepoWithSuffix = await services.gitRepository.create({
      uri: 'https://github.com/foo/bar.git',
    });
    const newRepoWithoutSuffix = await services.gitRepository.create({
      uri: 'https://github.com/foo/bar',
    });
    await repairDatabase();
    expect(await db.findOne(models.gitRepository.type, { _id: oldRepoWithSuffix._id })).toEqual(
      expect.objectContaining({
        uri: 'https://github.com/foo/bar.git',
        uriNeedsMigration: false,
      }),
    );
    expect(await db.findOne(models.gitRepository.type, { _id: oldRepoWithoutSuffix._id })).toEqual(
      expect.objectContaining({
        uri: 'https://github.com/foo/bar.git',
        uriNeedsMigration: false,
      }),
    );
    expect(await db.findOne(models.gitRepository.type, { _id: newRepoWithSuffix._id })).toEqual(
      expect.objectContaining({
        uri: 'https://github.com/foo/bar.git',
        uriNeedsMigration: false,
      }),
    );
    expect(await db.findOne(models.gitRepository.type, { _id: newRepoWithoutSuffix._id })).toEqual(
      expect.objectContaining({
        uri: 'https://github.com/foo/bar',
        uriNeedsMigration: false,
      }),
    );
  });
});

describe('duplicate()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('should overwrite appropriate fields on the parent when duplicating', async () => {
    const date = 1_478_795_580_200;
    Date.now = vi.fn().mockReturnValue(date);
    const workspace = await models.workspace.create({
      name: 'Test Workspace',
    });
    const newDescription = 'test';
    const duplicated = await db.duplicate(workspace, {
      description: newDescription,
    });
    expect(duplicated._id).not.toEqual(workspace._id);
    expect(duplicated._id).toMatch(/^wrk_[a-z0-9]{32}$/);
    delete workspace._id;
    delete duplicated._id;
    expect(duplicated).toEqual({
      ...workspace,
      description: newDescription,
      modified: date,
      created: date,
      type: models.workspace.type,
    });
  });

  it('should should not call migrate when duplicating', async () => {
    const workspace = await models.workspace.create({
      name: 'Test Workspace',
    });
    const spy = vi.spyOn(models.workspace, 'migrate');
    await db.duplicate(workspace);
    expect(spy).not.toHaveBeenCalled();
  });

  it('should rewrite chained request references when duplicating a folder', async () => {
    const workspace = await models.workspace.create({ name: 'Workspace' });
    const folder = await models.requestGroup.create({ parentId: workspace._id, name: 'Folder' });
    const req1 = await models.request.create({
      parentId: folder._id,
      name: 'Request 1',
      url: 'https://example.com/first',
    });
    const req2 = await models.request.create({
      parentId: folder._id,
      name: 'Request 2',
      url: `https://example.com/{% response 'body', '${req1._id}', 'b64::JC5pZA==::46b', 'never', 60 %}`,
    });

    const duplicatedFolder = await db.duplicate(folder);

    // Find duplicated requests
    const duplicatedRequests = await db.find<typeof req1>(models.request.type, {
      parentId: duplicatedFolder._id,
    });
    expect(duplicatedRequests).toHaveLength(2);

    const dupReq1 = duplicatedRequests.find(r => r.name === 'Request 1');
    const dupReq2 = duplicatedRequests.find(r => r.name === 'Request 2');
    expect(dupReq1).toBeDefined();
    expect(dupReq2).toBeDefined();

    // The duplicated req2 should reference the duplicated req1, not the original
    expect(dupReq2!.url).not.toContain(req1._id);
    expect(dupReq2!.url).toContain(dupReq1!._id);
    expect(dupReq2!.url).toContain("{% response 'body',");

    // Original should be unchanged
    const originalReq2 = await db.findOne(models.request.type, { _id: req2._id });
    expect(originalReq2!.url).toContain(req1._id);
  });
});

describe('docCreate()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('should call migrate when creating', async () => {
    const spy = vi.spyOn(models.workspace, 'migrate');
    await db.docCreate(models.workspace.type, {
      name: 'Test Workspace',
    });
    // TODO: This is actually called twice, not once - we should avoid the double model.init() call.
    expect(spy).toHaveBeenCalled();
  });
});

describe('withAncestors()', () => {
  it('should return itself and all parents but exclude siblings', async () => {
    const spc = await models.project.create();
    const wrk = await models.workspace.create({
      parentId: spc._id,
    });
    const wrkReq = await models.request.create({
      parentId: wrk._id,
    });
    const wrkGrpcReq = await models.grpcRequest.create({
      parentId: wrk._id,
    });
    const grp = await models.requestGroup.create({
      parentId: wrk._id,
    });
    const grpReq = await models.request.create({
      parentId: grp._id,
    });
    const grpGrpcReq = await models.grpcRequest.create({
      parentId: grp._id,
    });
    // Workspace child searching for ancestors
    await expect(db.withAncestors(wrk)).resolves.toStrictEqual([wrk, spc]);
    await expect(db.withAncestors(wrkReq)).resolves.toStrictEqual([wrkReq, wrk, spc]);
    await expect(db.withAncestors(wrkGrpcReq)).resolves.toStrictEqual([wrkGrpcReq, wrk, spc]);
    // Group searching for ancestors
    await expect(db.withAncestors(grp)).resolves.toStrictEqual([grp, wrk, spc]);
    // Group child searching for ancestors
    await expect(db.withAncestors(grpReq)).resolves.toStrictEqual([grpReq, grp, wrk, spc]);
    await expect(db.withAncestors(grpGrpcReq)).resolves.toStrictEqual([grpGrpcReq, grp, wrk, spc]);
    // Group child searching for ancestors with filters
    await expect(db.withAncestors(grpGrpcReq, [models.requestGroup.type])).resolves.toStrictEqual([grpGrpcReq, grp]);
    await expect(
      db.withAncestors(grpGrpcReq, [models.requestGroup.type, models.workspace.type]),
    ).resolves.toStrictEqual([grpGrpcReq, grp, wrk]);
    // Group child searching for ancestors but excluding groups will not find the workspace
    await expect(db.withAncestors(grpGrpcReq, [models.workspace.type])).resolves.toStrictEqual([grpGrpcReq]);
  });
});

describe('getWithDescendants()', () => {
  it('should return specified model and all children', async () => {
    const project = await models.project.create();
    const workspace = await models.workspace.create({
      _id: 'w1',
      parentId: project._id,
    });
    const cookieJar1 = await models.cookieJar.create({
      _id: 'j1',
      parentId: workspace._id,
      cookies: [
        // @ts-expect-error -- TSCONVERSION
        {
          id: '1',
          key: 'foo',
          value: '1',
        },
        // @ts-expect-error -- TSCONVERSION
        {
          id: 'j1_1',
          key: 'j1',
          value: '1',
        },
      ],
    });
    const cookieJar2 = await models.cookieJar.create({
      _id: 'j2',
      parentId: workspace._id,
      cookies: [
        // @ts-expect-error -- TSCONVERSION
        {
          id: '1',
          key: 'foo',
          value: '2',
        },
        // @ts-expect-error -- TSCONVERSION
        {
          id: 'j2_1',
          key: 'j2',
          value: '2',
        },
      ],
    });
    const folder1 = await models.requestGroup.create({
      _id: 'grp1',
      parentId: workspace._id,
    });
    const folder2 = await models.requestGroup.create({
      _id: 'grp2',
      parentId: folder1._id,
    });
    const request1 = await models.request.create({
      _id: 'req1',
      parentId: workspace._id,
    });
    const request2 = await models.request.create({
      _id: 'req2',
      parentId: folder1._id,
    });
    const grpcRequest1 = await models.grpcRequest.create({
      _id: 'grpc1',
      parentId: workspace._id,
    });
    const websocketRequest1 = await models.webSocketRequest.create({
      _id: 'ws1',
      parentId: workspace._id,
    });
    const socketIORequest1 = await models.socketIORequest.create({
      _id: 'socket1',
      parentId: workspace._id,
    });

    const environment1 = await models.environment.create({
      _id: 'env1',
      parentId: workspace._id,
    });

    const environment2 = await models.environment.create({
      _id: 'env2',
      parentId: environment1._id,
    });

    assert.sameDeepMembers(
      await db.getWithDescendants(workspace),
      [
        workspace,
        folder1,
        folder2,
        request1,
        request2,
        grpcRequest1,
        websocketRequest1,
        socketIORequest1,
        cookieJar1,
        cookieJar2,
        environment1,
        environment2,
      ],
      'Should return workspace with all descendants',
    );

    assert.sameDeepMembers(
      await db.getWithDescendants(workspace, [models.requestGroup.type]),
      [workspace, folder1, folder2],
      'Should return workspace with all request groups',
    );

    assert.sameDeepMembers(
      await db.getWithDescendants(workspace, [
        models.request.type,
        models.grpcRequest.type,
        models.webSocketRequest.type,
        models.socketIORequest.type,
      ]),
      [workspace, folder1, request1, folder2, request2, grpcRequest1, websocketRequest1, socketIORequest1],
      'Should return workspace with all request groups and requests',
    );
  });
});
