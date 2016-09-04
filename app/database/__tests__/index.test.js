import * as db from '../';
import {PREVIEW_MODE_SOURCE} from '../../lib/previewModes';

describe('requestCreate()', () => {
  beforeEach(() => {
    return db.initDB({inMemoryOnly: true})
  });

  it('creates a valid request', () => {
    const now = Date.now();

    const patch = {
      name: 'My Request',
      parentId: 'wrk_123'
    };

    return db.requestCreate(patch).then(r => {
      expect(Object.keys(r).length).toBe(14);

      expect(r._id).toMatch(/^req_[a-zA-Z0-9]{24}$/);
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
  });

  it('throws when missing parentID', () => {
    const fn = () => db.requestCreate({name: 'My Request'});
    expect(fn).toThrowError('New Requests missing `parentId`');
  });
});
