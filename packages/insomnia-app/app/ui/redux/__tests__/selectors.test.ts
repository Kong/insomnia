import * as models from '../../../models';
import { globalBeforeEach } from '../../../__jest__/before-each';
import { reduxStateForTest } from '../../../__jest__/redux-state-for-test';
import { selectActiveSpace } from '../selectors';

describe('selectors', () => {
  beforeEach(globalBeforeEach);

  describe('selectActiveSpace', () => {
    it('should return the active space', async () => {
      // create two spaces
      const spaceA = await models.space.create();
      await models.space.create();

      // set first as selected
      const state = await reduxStateForTest({ activeSpaceId: spaceA._id });

      const space = selectActiveSpace(state);
      expect(space).toStrictEqual(spaceA);
    });

    it('should return undefined if active space not found', async () => {
      // create two spaces
      await models.space.create();
      await models.space.create();

      // set first as selected
      const state = await reduxStateForTest({ activeSpaceId: 'some-other-space' });

      const space = selectActiveSpace(state);
      expect(space).toBeUndefined();
    });

    it('should return undefined if no active space', async () => {
      // create two spaces
      await models.space.create();
      await models.space.create();

      // set first as selected
      const state = await reduxStateForTest({ activeSpaceId: null });

      const space = selectActiveSpace(state);
      expect(space).toBeUndefined();
    });
  });
});
