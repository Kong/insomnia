import { ACTIVITY_HOME } from '../../../common/constants';
import { trackEvent, trackSegmentEvent } from '../../../common/analytics';
import { showAlert, showPrompt } from '../../components/modals';
import { setActiveActivity, setActiveSpace } from './global';
import * as models from '../../../models';
import { strings } from '../../../common/strings';
import { BASE_SPACE_ID, Space } from '../../../models/space';

export const createSpace = () => dispatch => {
  const defaultValue = 'My Space';

  showPrompt({
    title: `Create New ${strings.space.singular}`,
    submitName: 'Create',
    cancelable: true,
    placeholder: defaultValue,
    defaultValue,
    selectText: true,
    onComplete: async (name) => {
      const space = await models.space.create({ name });
      trackEvent('Space', 'Create');
      dispatch(setActiveSpace(space._id));
      dispatch(setActiveActivity(ACTIVITY_HOME));
      trackSegmentEvent('Local Space Created');
    },
  });
};

export const removeSpace = (space: Space) => dispatch => {
  showAlert({
    title: `Delete ${strings.space.singular}`,
    message: `Deleting a space will delete all ${strings.document.plural.toLowerCase()} and ${strings.collection.plural.toLowerCase()} within. This cannot be undone. Are you sure you want to delete ${space.name}?`,
    addCancel: true,
    okLabel: 'Delete',
    onConfirm: async () => {
      await models.stats.incrementDeletedRequestsForDescendents(space);
      await models.space.remove(space);
      trackEvent('Space', 'Delete');
      // Show base space
      dispatch(setActiveSpace(BASE_SPACE_ID));
      // Show home in case not already on home
      dispatch(setActiveActivity(ACTIVITY_HOME));
      trackSegmentEvent('Local Space Deleted');
    },
  });
};
