// @flow
import type { Database } from '../../index';
import { emptyDb } from '../../index';
import type { Workspace } from '../types';
import { generateIdIsh } from '../util';
import { loadWorkspace } from '../workspace';

describe('workspace', () => {
  let db: Database = emptyDb();

  const workspace: $Shape<Workspace> = {
    _id: 'wrk_1234567890',
    name: 'workspace name',
  };

  beforeEach(() => {
    db = emptyDb();

    const dummyWorkspace: $Shape<Workspace> = {
      _id: 'wrk_dummy',
      name: 'dummy workspace',
    };

    db.Workspace.push(workspace);
    db.Workspace.push(dummyWorkspace);
  });

  describe('loadWorkspace()', () => {
    it('should return null if workspace not found', () => {
      expect(loadWorkspace(db, 'not-found')).toBeNull();
    });

    it.each([generateIdIsh(workspace), workspace._id, workspace.name])(
      'should return workspace with identifier: %o',
      identifier => {
        expect(loadWorkspace(db, identifier)).toBe(workspace);
      },
    );

    it('should throw error if multiple workspace matched', () => {
      db.Workspace.push({ ...workspace });

      expect(() => loadWorkspace(db, workspace._id)).toThrowError();
    });
  });
});
