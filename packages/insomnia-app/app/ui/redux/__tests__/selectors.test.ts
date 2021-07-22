import { globalBeforeEach } from '../../../__jest__/before-each';
import { reduxStateForTest } from '../../../__jest__/redux-state-for-test';
import * as models from '../../../models';
import { BASE_SPACE_ID, Space } from '../../../models/space';
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
      expect(space).toStrictEqual(expect.objectContaining<Partial<Space>>({ _id: BASE_SPACE_ID }));
    });

    it('should return undefined if no active space', async () => {
      // create two spaces
      await models.space.create();
      await models.space.create();

      // set base as selected
      const state = await reduxStateForTest({ activeSpaceId: undefined });

      const space = selectActiveSpace(state);
      expect(space).toStrictEqual(expect.objectContaining<Partial<Space>>({ _id: BASE_SPACE_ID }));
    });
  });
});
