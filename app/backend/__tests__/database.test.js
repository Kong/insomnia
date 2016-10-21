import * as db from '../database';
import {PREVIEW_MODE_SOURCE} from '../previewModes';

function loadFixture (name) {
  const fixtures = require(`../__fixtures__/${name}`);
  const promises = [];
  for (const type of Object.keys(fixtures)) {
    for (const doc of fixtures[type]) {
      promises.push(db.insert(Object.assign({}, doc, {type})));
    }
  }
}

describe('requestCreate()', () => {
  beforeEach(() => {
    return db.initDB({inMemoryOnly: true}, true);
  });

  it('creates a valid request', async () => {
    const now = Date.now();

    const patch = {
      name: 'My Request',
      parentId: 'wrk_123'
    };

    const r = await db.request.create(patch);
    expect(Object.keys(r).length).toBe(15);

    expect(r._id).toMatch(/^req_[a-zA-Z0-9]{32}$/);
    expect(r.created).toBeGreaterThanOrEqual(now);
    expect(r.modified).toBeGreaterThanOrEqual(now);
    expect(r.type).toBe('Request');
    expect(r.name).toBe('My Request');
    expect(r.url).toBe('');
    expect(r.method).toBe('GET');
    expect(r.body).toBe('');
    expect(r.parameters).toEqual([]);
    expect(r.headers).toEqual([]);
    expect(r.authentication).toEqual({});
    expect(r.metaSortKey).toBeLessThanOrEqual(-1 * now);
    expect(r.metaPreviewMode).toEqual(PREVIEW_MODE_SOURCE);
    expect(r.parentId).toBe('wrk_123');
  });

  it('throws when missing parentID', () => {
    const fn = () => db.request.create({name: 'My Request'});
    expect(fn).toThrowError('New Requests missing `parentId`');
  });
});

describe('requestGroupDuplicate()', () => {
  beforeEach(async () => {
    await db.initDB({inMemoryOnly: true}, true);
    await loadFixture('nestedfolders');
  });

  it('duplicates a RequestGroup', async () => {
    const requestGroup = await db.requestGroup.getById('fld_1');
    expect(requestGroup.name).toBe('Fld 1');

    const newRequestGroup = await db.requestGroup.duplicate(requestGroup);
    expect(newRequestGroup._id).not.toBe(requestGroup._id);
    expect(newRequestGroup.name).toBe('Fld 1 (Copy)');

    const allRequests = await db.request.all();
    const allRequestGroups = await db.requestGroup.all();
    const childRequests = await db.request.findByParentId(requestGroup._id);
    const childRequestGroups = await db.requestGroup.findByParentId(requestGroup._id);
    const newChildRequests = await db.request.findByParentId(newRequestGroup._id);
    const newChildRequestGroups = await db.requestGroup.findByParentId(newRequestGroup._id);
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
