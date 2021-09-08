import { globalBeforeEach } from '../../__jest__/before-each';
import * as models from '../../models';
import { data as fixtures } from '../__fixtures__/nestedfolders';
import { _repairDatabase, database as db } from '../database';

function loadFixture() {
  const promises: Promise<models.BaseModel>[] = [];
  for (const type of Object.keys(fixtures)) {
    for (const doc of fixtures[type]) {
      // @ts-expect-error -- TSCONVERSION
      promises.push(db.insert<models.BaseModel>({ ...doc, type }));
    }
  }
  return Promise.all(promises);
}

describe('init()', () => {
  beforeEach(globalBeforeEach);

  it('handles being initialized twice', async () => {
    await db.init(models.types(), {
      inMemoryOnly: true,
    });
    await db.init(models.types(), {
      inMemoryOnly: true,
    });
    expect((await db.all(models.request.type)).length).toBe(0);
  });
});

describe('onChange()', () => {
  beforeEach(globalBeforeEach);

  it('handles change listeners', async () => {
    const doc = {
      type: models.request.type,
      parentId: 'nothing',
      name: 'foo',
    };
    const changesSeen: Function[] = [];

    const callback = change => {
      changesSeen.push(change);
    };

    db.onChange(callback);
    const newDoc = await models.request.create(doc);
    const updatedDoc = await models.request.update(newDoc, {
      name: 'bar',
    });
    expect(changesSeen.length).toBe(2);
    expect(changesSeen).toEqual([
      [[db.CHANGE_INSERT, newDoc, false]],
      [[db.CHANGE_UPDATE, updatedDoc, false]],
    ]);
    db.offChange(callback);
    await models.request.create(doc);
    expect(changesSeen.length).toBe(2);
  });
});

describe('bufferChanges()', () => {
  beforeEach(globalBeforeEach);

  it('properly buffers changes', async () => {
    const doc = {
      type: models.request.type,
      parentId: 'n/a',
      name: 'foo',
    };
    const changesSeen: Function[] = [];

    const callback = change => {
      changesSeen.push(change);
    };

    db.onChange(callback);
    await db.bufferChanges();
    const newDoc = await models.request.create(doc);
    // @ts-expect-error -- TSCONVERSION appears to be genuine
    const updatedDoc = await models.request.update(newDoc, true);
    // Assert no change seen before flush
    expect(changesSeen.length).toBe(0);
    // Assert changes seen after flush
    await db.flushChanges();
    expect(changesSeen).toEqual([
      [
        [db.CHANGE_INSERT, newDoc, false],
        [db.CHANGE_UPDATE, updatedDoc, false],
      ],
    ]);
    // Assert no more changes seen after flush again
    await db.flushChanges();
    expect(changesSeen).toEqual([
      [
        [db.CHANGE_INSERT, newDoc, false],
        [db.CHANGE_UPDATE, updatedDoc, false],
      ],
    ]);
  });

  it('should auto flush after a default wait', async () => {
    const doc = {
      type: models.request.type,
      parentId: 'n/a',
      name: 'foo',
    };
    const changesSeen: Function[] = [];

    const callback = change => {
      changesSeen.push(change);
    };

    db.onChange(callback);
    await db.bufferChanges();
    const newDoc = await models.request.create(doc);
    // @ts-expect-error -- TSCONVERSION appears to be genuine
    const updatedDoc = await models.request.update(newDoc, true);
    // Default flush timeout is 1000ms after starting buffering
    await new Promise(resolve => setTimeout(resolve, 1500));
    expect(changesSeen).toEqual([
      [
        [db.CHANGE_INSERT, newDoc, false],
        [db.CHANGE_UPDATE, updatedDoc, false],
      ],
    ]);
  });

  it('should auto flush after a specified wait', async () => {
    const doc = {
      type: models.request.type,
      parentId: 'n/a',
      name: 'foo',
    };
    const changesSeen: Function[] = [];

    const callback = change => {
      changesSeen.push(change);
    };

    db.onChange(callback);
    await db.bufferChanges(500);
    const newDoc = await models.request.create(doc);
    // @ts-expect-error -- TSCONVERSION appears to be genuine
    const updatedDoc = await models.request.update(newDoc, true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(changesSeen).toEqual([
      [
        [db.CHANGE_INSERT, newDoc, false],
        [db.CHANGE_UPDATE, updatedDoc, false],
      ],
    ]);
  });
});

describe('bufferChangesIndefinitely()', () => {
  beforeEach(globalBeforeEach);

  it('should not auto flush', async () => {
    const doc = {
      type: models.request.type,
      parentId: 'n/a',
      name: 'foo',
    };
    const changesSeen: Function[] = [];

    const callback = change => {
      changesSeen.push(change);
    };

    db.onChange(callback);
    await db.bufferChangesIndefinitely();
    const newDoc = await models.request.create(doc);
    // @ts-expect-error -- TSCONVERSION appears to be genuine
    const updatedDoc = await models.request.update(newDoc, true);
    // Default flush timeout is 1000ms after starting buffering
    await new Promise(resolve => setTimeout(resolve, 1500));
    // Assert no change seen before flush
    expect(changesSeen.length).toBe(0);
    // Assert changes seen after flush
    await db.flushChanges();
    expect(changesSeen).toEqual([
      [
        [db.CHANGE_INSERT, newDoc, false],
        [db.CHANGE_UPDATE, updatedDoc, false],
      ],
    ]);
  });
});

describe('requestCreate()', () => {
  beforeEach(globalBeforeEach);

  it('creates a valid request', async () => {
    const now = Date.now();
    const patch = {
      name: 'My Request',
      parentId: 'wrk_123',
    };
    const r = await models.request.create(patch);
    expect(Object.keys(r).length).toBe(21);
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

describe('requestGroupDuplicate()', () => {
  beforeEach(async () => {
    await globalBeforeEach();
    await loadFixture();
  });

  it('duplicates a RequestGroup', async () => {
    const requestGroup = await models.requestGroup.getById('fld_1');
    expect(requestGroup).not.toEqual(null);
    if (requestGroup === null) {
      return;
    }

    expect(requestGroup.name).toBe('Fld 1');
    const newRequestGroup = await models.requestGroup.duplicate(requestGroup);
    expect(newRequestGroup._id).not.toBe(requestGroup._id);
    expect(newRequestGroup.name).toBe('Fld 1 (Copy)');
    const allRequests = await models.request.all();
    const allRequestGroups = await models.requestGroup.all();
    const childRequests = await models.request.findByParentId(requestGroup._id);
    const childRequestGroups = await models.requestGroup.findByParentId(requestGroup._id);
    const newChildRequests = await models.request.findByParentId(newRequestGroup._id);
    const newChildRequestGroups = await models.requestGroup.findByParentId(newRequestGroup._id);
    // This asserting is pretty garbage but it at least checks
    // to see that the recursion worked (for the most part)
    expect(allRequests.length).toBe(8);
    expect(allRequestGroups.length).toBe(5);
    expect(childRequests.length).toBe(2);
    expect(childRequestGroups.length).toBe(1);
    expect(newChildRequests.length).toBe(2);
    expect(newChildRequestGroups.length).toBe(1);
  });
});

describe('_repairDatabase()', () => {
  beforeEach(globalBeforeEach);

  it('fixes duplicate environments', async () => {
    // Create Workspace with no children
    const project = await models.project.create();
    const workspace = await models.workspace.create({
      _id: 'w1',
      parentId: project._id,
    });
    const spec = await models.apiSpec.getByParentId(workspace._id);
    expect((await db.withDescendants(workspace)).length).toBe(2);
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
    // Make sure we have everything
    expect((await db.withDescendants(workspace)).length).toBe(8);
    const descendants = (await db.withDescendants(workspace)).map(d => ({
      _id: d._id,
      parentId: d.parentId,
      // @ts-expect-error -- TSCONVERSION appears to be genuine
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
      expect.objectContaining({
        _id: spec?._id,
        parentId: 'w1',
      }),
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
    await _repairDatabase();

    // Make sure things get adjusted
    const descendants2 = (await db.withDescendants(workspace)).map(d => ({
      _id: d._id,
      parentId: d.parentId,
      // @ts-expect-error -- TSCONVERSION appears to be genuine
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
      expect.objectContaining({
        _id: spec?._id,
        parentId: 'w1',
      }), // Extra base environments should have been deleted
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
    const spec = await models.apiSpec.getByParentId(workspace._id);
    expect((await db.withDescendants(workspace)).length).toBe(2);
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
    // Make sure we have everything
    expect((await db.withDescendants(workspace)).length).toBe(4);
    const descendants = (await db.withDescendants(workspace)).map(d => ({
      _id: d._id,
      // @ts-expect-error -- TSCONVERSION
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
      expect.objectContaining({
        _id: spec?._id,
        parentId: 'w1',
      }),
    ]);
    // Run the fix algorithm
    await _repairDatabase();
    // Make sure things get adjusted
    const descendants2 = (await db.withDescendants(workspace)).map(d => ({
      _id: d._id,
      // @ts-expect-error -- TSCONVERSION
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
      expect.objectContaining({
        _id: spec?._id,
        parentId: 'w1',
      }),
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
    await models.apiSpec.updateOrCreateForParentId(w1._id, {
      fileName: '',
    });
    await models.apiSpec.updateOrCreateForParentId(w2._id, {
      fileName: models.apiSpec.init().fileName,
    });
    await models.apiSpec.updateOrCreateForParentId(w3._id, {
      fileName: 'Unique name',
    });
    // Make sure we have everything
    expect((await models.apiSpec.getByParentId(w1._id))?.fileName).toBe('');
    expect((await models.apiSpec.getByParentId(w2._id))?.fileName).toBe('New Document');
    expect((await models.apiSpec.getByParentId(w3._id))?.fileName).toBe('Unique name');
    // Run the fix algorithm
    await _repairDatabase();
    // Make sure things get adjusted
    expect((await models.apiSpec.getByParentId(w1._id))?.fileName).toBe('Workspace 1'); // Should fix
    expect((await models.apiSpec.getByParentId(w2._id))?.fileName).toBe('Workspace 2'); // Should fix
    expect((await models.apiSpec.getByParentId(w3._id))?.fileName).toBe('Unique name'); // should not fix
  });

  it('fixes old git uris', async () => {
    const oldRepoWithSuffix = await models.gitRepository.create({
      uri: 'https://github.com/foo/bar.git',
      uriNeedsMigration: true,
    });
    const oldRepoWithoutSuffix = await models.gitRepository.create({
      uri: 'https://github.com/foo/bar',
      uriNeedsMigration: true,
    });
    const newRepoWithSuffix = await models.gitRepository.create({
      uri: 'https://github.com/foo/bar.git',
    });
    const newRepoWithoutSuffix = await models.gitRepository.create({
      uri: 'https://github.com/foo/bar',
    });
    await _repairDatabase();
    expect(await db.get(models.gitRepository.type, oldRepoWithSuffix._id)).toEqual(
      expect.objectContaining({
        uri: 'https://github.com/foo/bar.git',
        uriNeedsMigration: false,
      }),
    );
    expect(await db.get(models.gitRepository.type, oldRepoWithoutSuffix._id)).toEqual(
      expect.objectContaining({
        uri: 'https://github.com/foo/bar.git',
        uriNeedsMigration: false,
      }),
    );
    expect(await db.get(models.gitRepository.type, newRepoWithSuffix._id)).toEqual(
      expect.objectContaining({
        uri: 'https://github.com/foo/bar.git',
        uriNeedsMigration: false,
      }),
    );
    expect(await db.get(models.gitRepository.type, newRepoWithoutSuffix._id)).toEqual(
      expect.objectContaining({
        uri: 'https://github.com/foo/bar',
        uriNeedsMigration: false,
      }),
    );
  });
});

describe('duplicate()', () => {
  beforeEach(globalBeforeEach);
  afterEach(() => jest.restoreAllMocks());

  it('should overwrite appropriate fields on the parent when duplicating', async () => {
    const date = 1478795580200;
    Date.now = jest.fn().mockReturnValue(date);
    const workspace = await models.workspace.create({
      name: 'Test Workspace',
    });
    const newDescription = 'test';
    const duplicated = await db.duplicate(workspace, {
      description: newDescription,
    });
    expect(duplicated._id).not.toEqual(workspace._id);
    expect(duplicated._id).toMatch(/^wrk_[a-z0-9]{32}$/);
    // @ts-expect-error -- TSCONVERSION
    delete workspace._id;
    // @ts-expect-error -- TSCONVERSION
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
    const spy = jest.spyOn(models.workspace, 'migrate');
    await db.duplicate(workspace);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('docCreate()', () => {
  beforeEach(globalBeforeEach);
  afterEach(() => jest.restoreAllMocks());

  it('should call migrate when creating', async () => {
    const spy = jest.spyOn(models.workspace, 'migrate');
    await db.docCreate(models.workspace.type, {
      name: 'Test Workspace',
    });
    // TODO: This is actually called twice, not once - we should avoid the double model.init() call.
    expect(spy).toHaveBeenCalled();
  });
});

describe('withAncestors()', () => {
  beforeEach(globalBeforeEach);

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
    await expect(db.withAncestors(grpGrpcReq, [models.requestGroup.type])).resolves.toStrictEqual([
      grpGrpcReq,
      grp,
    ]);
    await expect(
      db.withAncestors(grpGrpcReq, [models.requestGroup.type, models.workspace.type]),
    ).resolves.toStrictEqual([grpGrpcReq, grp, wrk]);
    // Group child searching for ancestors but excluding groups will not find the workspace
    await expect(db.withAncestors(grpGrpcReq, [models.workspace.type])).resolves.toStrictEqual([
      grpGrpcReq,
    ]);
  });
});
