import { globalBeforeEach } from '../../../__jest__/before-each';
import { reduxStateForTest } from '../../../__jest__/redux-state-for-test';
import * as models from '../../../models';
import { BASE_PROJECT_ID, Space } from '../../../models/project';
import { selectActiveProject } from '../selectors';

describe('selectors', () => {
  beforeEach(globalBeforeEach);

  describe('selectActiveSpace', () => {
    it('should return the active space', async () => {
      // create two spaces
      const spaceA = await models.space.create();
      await models.space.create();

      // set first as selected
      const state = await reduxStateForTest({ activeProjectId: spaceA._id });

      const space = selectActiveProject(state);
      expect(space).toStrictEqual(spaceA);
    });

    it('should return base space if active space not found', async () => {
      // create two spaces
      await models.space.create();
      await models.space.create();

      // set first as selected
      const state = await reduxStateForTest({ activeProjectId: 'some-other-space' });

      const space = selectActiveProject(state);
      expect(space).toStrictEqual(expect.objectContaining<Partial<Space>>({ _id: BASE_PROJECT_ID }));
    });

    it('should return base space if no active space', async () => {
      // create two spaces
      await models.space.create();
      await models.space.create();

      // set base as selected
      const state = await reduxStateForTest({ activeProjectId: undefined });

      const space = selectActiveProject(state);
      expect(space).toStrictEqual(expect.objectContaining<Partial<Space>>({ _id: BASE_PROJECT_ID }));
    });
  });
});
