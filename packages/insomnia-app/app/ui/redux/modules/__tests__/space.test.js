import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { globalBeforeEach } from '../../../../__jest__/before-each';
import { createSpace, removeSpace } from '../space';
import * as models from '../../../../models';
import { trackEvent, trackSegmentEvent } from '../../../../common/analytics';
import { ACTIVITY_HOME } from '../../../../common/constants';
import { SET_ACTIVE_ACTIVITY, SET_ACTIVE_SPACE } from '../global';
import { getAndClearShowAlertMockArgs, getAndClearShowPromptMockArgs } from '../../../../test-utils';
import { BASE_SPACE_ID } from '../../../../models/space';
import reduxStateForTest from '../../../../__jest__/redux-state-for-test';

jest.mock('../../../components/modals');
jest.mock('../../../../common/analytics');

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('space', () => {
  beforeEach(globalBeforeEach);
  describe('createSpace', () => {
    it('should create space', async () => {
      const store = mockStore(await reduxStateForTest());
      store.dispatch(createSpace());

      const {
        title,
        submitName,
        defaultValue,
        onComplete,
        cancelable,
        placeholder,
        selectText,
      } = getAndClearShowPromptMockArgs();

      expect(title).toBe('Create New Space');
      expect(submitName).toBe('Create');
      expect(cancelable).toBe(true);
      expect(defaultValue).toBe(placeholder);
      expect(placeholder).toBe('My Space');
      expect(selectText).toBe(true);

      const spaceName = 'name';
      await onComplete?.(spaceName);

      const spaces = await models.space.all();
      expect(spaces).toHaveLength(1);
      const space = spaces[0];
      expect(space.name).toBe(spaceName);
      expect(trackSegmentEvent).toHaveBeenCalledWith('Local Space Created');
      expect(trackEvent).toHaveBeenCalledWith('Space', 'Create');
      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_SPACE,
          spaceId: space._id,
        },
        {
          type: SET_ACTIVE_ACTIVITY,
          activity: ACTIVITY_HOME,
        },
      ]);
    });
  });

  describe('removeSpace', () => {
    it('should remove space', async () => {
      const store = mockStore(await reduxStateForTest());
      const spaceOne = await models.space.create({ name: 'My Space' });
      const spaceTwo = await models.space.create();

      store.dispatch(removeSpace(spaceOne));

      const {
        title,
        message,
        addCancel,
        okLabel,
        onConfirm,
      } = getAndClearShowAlertMockArgs();

      expect(title).toBe('Delete Space');
      expect(message).toBe('Deleting a space will delete all documents and collections within. This cannot be undone. Are you sure you want to delete My Space?');
      expect(addCancel).toBe(true);
      expect(okLabel).toBe('Delete');

      await expect(models.space.all()).resolves.toHaveLength(2);

      await onConfirm();

      const spaces = await models.space.all();
      expect(spaces).toHaveLength(1);
      const space = spaces[0];
      expect(space).toBe(spaceTwo);
      expect(trackSegmentEvent).toHaveBeenCalledWith('Local Space Deleted');
      expect(trackEvent).toHaveBeenCalledWith('Space', 'Delete');
      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_SPACE,
          spaceId: BASE_SPACE_ID,
        },
        {
          type: SET_ACTIVE_ACTIVITY,
          activity: ACTIVITY_HOME,
        },
      ]);
    });
  });
});
