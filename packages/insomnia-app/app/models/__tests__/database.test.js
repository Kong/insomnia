// @flow

import * as models from '../index';
import * as db from '../../common/database';
import { globalBeforeEach } from '../../__jest__/before-each';

describe('database', () => {
  beforeEach(globalBeforeEach);
  afterEach(() => jest.restoreAllMocks());

  describe('duplicate()', () => {
    it('should overwrite appropriate fields on the parent when duplicating', async () => {
      const date = 1478795580200;
      Date.now = jest.fn().mockReturnValue(date);

      const workspace = await models.workspace.create({
        name: 'Test Workspace',
      });

      const newDescription = 'test';
      const duplicated = await db.duplicate(workspace, { description: newDescription });

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

      const spy = jest.spyOn(models.workspace, 'migrate');
      await db.duplicate(workspace);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('docCreate()', () => {
    it('should call migrate when creating', async () => {
      const spy = jest.spyOn(models.workspace, 'migrate');

      await db.docCreate(models.workspace.type, {
        name: 'Test Workspace',
      });

      // TODO: This is actually called twice, not once - we should avoid the double model.init() call.
      expect(spy).toHaveBeenCalled();
    });
  });
});
