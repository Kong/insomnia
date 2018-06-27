import * as models from '../../models';
import * as db from '../database';
import { globalBeforeEach } from '../../__jest__/before-each';

function loadFixture(name) {
  const fixtures = require(`../__fixtures__/${name}`).data;
  const promises = [];
  for (const type of Object.keys(fixtures)) {
    for (const doc of fixtures[type]) {
      promises.push(db.insert(Object.assign({}, doc, { type })));
    }
  }

  return Promise.all(promises);
}

describe('init()', () => {
  beforeEach(globalBeforeEach);
  it('handles being initialized twice', async () => {
    await db.init(models.types(), { inMemoryOnly: true });
    await db.init(models.types(), { inMemoryOnly: true });
    expect((await db.all(models.request.type)).length).toBe(0);
  });
});

describe('onChange()', () => {
  beforeEach(globalBeforeEach);
  it('handles change listeners', async () => {
    const doc = {
      type: models.request.type,
      parentId: 'nothing',
      name: 'foo'
    };

    const changesSeen = [];
    const callback = change => {
      changesSeen.push(change);
    };
    db.onChange(callback);

    const newDoc = await models.request.create(doc);
    const updatedDoc = await models.request.update(newDoc, { name: 'bar' });
    expect(changesSeen.length).toBe(2);

    expect(changesSeen).toEqual([
      [[db.CHANGE_INSERT, newDoc, false]],
      [[db.CHANGE_UPDATE, updatedDoc, false]]
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
      name: 'foo'
    };

    const changesSeen = [];
    const callback = change => {
      changesSeen.push(change);
    };
    db.onChange(callback);

    await db.bufferChanges();
    const newDoc = await models.request.create(doc);
    const updatedDoc = await models.request.update(newDoc, true);

    // Assert no change seen before flush
    expect(changesSeen.length).toBe(0);

    // Assert changes seen after flush
    await db.flushChanges();
    expect(changesSeen).toEqual([
      [[db.CHANGE_INSERT, newDoc, false], [db.CHANGE_UPDATE, updatedDoc, false]]
    ]);

    // Assert no more changes seen after flush again
    await db.flushChanges();
    expect(changesSeen).toEqual([
      [[db.CHANGE_INSERT, newDoc, false], [db.CHANGE_UPDATE, updatedDoc, false]]
    ]);
  });
});

describe('requestCreate()', () => {
  beforeEach(globalBeforeEach);
  it('creates a valid request', async () => {
    const now = Date.now();

    const patch = {
      name: 'My Request',
      parentId: 'wrk_123'
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
    const fn = () => models.request.create({ name: 'My Request' });
    expect(fn).toThrowError('New Requests missing `parentId`');
  });
});

describe('requestGroupDuplicate()', () => {
  beforeEach(async () => {
    await globalBeforeEach();
    await loadFixture('nestedfolders');
  });

  it('duplicates a RequestGroup', async () => {
    const requestGroup = await models.requestGroup.getById('fld_1');
    expect(requestGroup.name).toBe('Fld 1');

    const newRequestGroup = await models.requestGroup.duplicate(requestGroup);
    expect(newRequestGroup._id).not.toBe(requestGroup._id);
    expect(newRequestGroup.name).toBe('Fld 1 (Copy)');

    const allRequests = await models.request.all();
    const allRequestGroups = await models.requestGroup.all();
    const childRequests = await models.request.findByParentId(requestGroup._id);
    const childRequestGroups = await models.requestGroup.findByParentId(
      requestGroup._id
    );
    const newChildRequests = await models.request.findByParentId(
      newRequestGroup._id
    );
    const newChildRequestGroups = await models.requestGroup.findByParentId(
      newRequestGroup._id
    );
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

describe('_fixThings()', () => {
  beforeEach(globalBeforeEach);
  it('fixes duplicate environments', async () => {
    // Create Workspace with no children
    const workspace = await models.workspace.create({ _id: 'w1' });
    expect((await db.withDescendants(workspace)).length).toBe(1);

    // Create one set of sub environments
    await models.environment.create({
      _id: 'b1',
      parentId: 'w1',
      data: { foo: 'b1', b1: true }
    });
    await models.environment.create({
      _id: 'b1_sub1',
      parentId: 'b1',
      data: { foo: '1' }
    });
    await models.environment.create({
      _id: 'b1_sub2',
      parentId: 'b1',
      data: { foo: '2' }
    });

    // Create second set of sub environments
    await models.environment.create({
      _id: 'b2',
      parentId: 'w1',
      data: { foo: 'b2', b2: true }
    });
    await models.environment.create({
      _id: 'b2_sub1',
      parentId: 'b2',
      data: { foo: '3' }
    });
    await models.environment.create({
      _id: 'b2_sub2',
      parentId: 'b2',
      data: { foo: '4' }
    });

    // Make sure we have everything
    expect((await db.withDescendants(workspace)).length).toBe(7);
    const descendants = (await db.withDescendants(workspace)).map(d => ({
      _id: d._id,
      parentId: d.parentId,
      data: d.data || null
    }));
    expect(descendants).toEqual([
      { _id: 'w1', data: null, parentId: null },
      { _id: 'b1', data: { foo: 'b1', b1: true }, parentId: 'w1' },
      { _id: 'b2', data: { foo: 'b2', b2: true }, parentId: 'w1' },
      { _id: 'b1_sub1', data: { foo: '1' }, parentId: 'b1' },
      { _id: 'b1_sub2', data: { foo: '2' }, parentId: 'b1' },
      { _id: 'b2_sub1', data: { foo: '3' }, parentId: 'b2' },
      { _id: 'b2_sub2', data: { foo: '4' }, parentId: 'b2' }
    ]);

    // Run the fix algorithm
    await db._repairDatabase();

    // Make sure things get adjusted
    const descendants2 = (await db.withDescendants(workspace)).map(d => ({
      _id: d._id,
      parentId: d.parentId,
      data: d.data || null
    }));
    expect(descendants2).toEqual([
      { _id: 'w1', data: null, parentId: null },
      { _id: 'b1', data: { foo: 'b1', b1: true, b2: true }, parentId: 'w1' },

      // Extra base environments should have been deleted
      // {_id: 'b2', data: {foo: 'bar'}, parentId: 'w1'},

      // Sub environments should have been moved to new "master" base environment
      { _id: 'b1_sub1', data: { foo: '1' }, parentId: 'b1' },
      { _id: 'b1_sub2', data: { foo: '2' }, parentId: 'b1' },
      { _id: 'b2_sub1', data: { foo: '3' }, parentId: 'b1' },
      { _id: 'b2_sub2', data: { foo: '4' }, parentId: 'b1' }
    ]);
  });

  it('fixes duplicate cookie jars', async () => {
    // Create Workspace with no children
    const workspace = await models.workspace.create({ _id: 'w1' });
    expect((await db.withDescendants(workspace)).length).toBe(1);

    // Create one set of sub environments
    await models.cookieJar.create({
      _id: 'j1',
      parentId: 'w1',
      cookies: [
        { id: '1', key: 'foo', value: '1' },
        { id: 'j1_1', key: 'j1', value: '1' }
      ]
    });

    await models.cookieJar.create({
      _id: 'j2',
      parentId: 'w1',
      cookies: [
        { id: '1', key: 'foo', value: '2' },
        { id: 'j2_1', key: 'j2', value: '2' }
      ]
    });

    // Make sure we have everything
    expect((await db.withDescendants(workspace)).length).toBe(3);
    const descendants = (await db.withDescendants(workspace)).map(d => ({
      _id: d._id,
      cookies: d.cookies || null,
      parentId: d.parentId
    }));
    expect(descendants).toEqual([
      { _id: 'w1', cookies: null, parentId: null },
      {
        _id: 'j1',
        parentId: 'w1',
        cookies: [
          { id: '1', key: 'foo', value: '1' },
          { id: 'j1_1', key: 'j1', value: '1' }
        ]
      },
      {
        _id: 'j2',
        parentId: 'w1',
        cookies: [
          { id: '1', key: 'foo', value: '2' },
          { id: 'j2_1', key: 'j2', value: '2' }
        ]
      }
    ]);

    // Run the fix algorithm
    await db._repairDatabase();

    // Make sure things get adjusted
    const descendants2 = (await db.withDescendants(workspace)).map(d => ({
      _id: d._id,
      cookies: d.cookies || null,
      parentId: d.parentId
    }));
    expect(descendants2).toEqual([
      { _id: 'w1', cookies: null, parentId: null },
      {
        _id: 'j1',
        parentId: 'w1',
        cookies: [
          { id: '1', key: 'foo', value: '1' },
          { id: 'j1_1', key: 'j1', value: '1' },
          { id: 'j2_1', key: 'j2', value: '2' }
        ]
      }
    ]);
  });
});
