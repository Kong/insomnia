import * as models from '../../models';
import * as db from '../database';

function loadFixture (name) {
  const fixtures = require(`../__fixtures__/${name}`).data;
  const promises = [];
  for (const type of Object.keys(fixtures)) {
    for (const doc of fixtures[type]) {
      promises.push(db.insert(Object.assign({}, doc, {type})));
    }
  }

  return Promise.all(promises);
}

describe('init()', () => {
  it('handles being initialized twice', async () => {
    await db.init(models.types(), {inMemoryOnly: true});
    await db.init(models.types(), {inMemoryOnly: true});
    expect((await db.all(models.request.type)).length).toBe(0);
  });
});

describe('onChange()', () => {
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
    const updatedDoc = await models.request.update(newDoc, {name: 'bar'});
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

    db.bufferChanges();
    const newDoc = await models.request.create(doc);
    const updatedDoc = await models.request.update(newDoc, true);

    // Assert no change seen before flush
    expect(changesSeen.length).toBe(0);

    // Assert changes seen after flush
    db.flushChanges();
    expect(changesSeen).toEqual([[
      [db.CHANGE_INSERT, newDoc, false],
      [db.CHANGE_UPDATE, updatedDoc, false]
    ]]);

    // Assert no more changes seen after flush again
    db.flushChanges();
    expect(changesSeen).toEqual([[
      [db.CHANGE_INSERT, newDoc, false],
      [db.CHANGE_UPDATE, updatedDoc, false]
    ]]);
  });
});

describe('requestCreate()', () => {
  beforeEach(() => db.init(models.types(), {inMemoryOnly: true}, true));

  it('creates a valid request', async () => {
    const now = Date.now();

    const patch = {
      name: 'My Request',
      parentId: 'wrk_123'
    };

    const r = await models.request.create(patch);
    expect(Object.keys(r).length).toBe(13);

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
    const fn = () => models.request.create({name: 'My Request'});
    expect(fn).toThrowError('New Requests missing `parentId`');
  });
});

describe('requestGroupDuplicate()', () => {
  beforeEach(async () => {
    await db.init(models.types(), {inMemoryOnly: true}, true);
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
  })
});
