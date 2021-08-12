import { trackEvent, trackSegmentEvent } from '../../../common/analytics';
import { ACTIVITY_HOME } from '../../../common/constants';
import { strings } from '../../../common/strings';
import * as models from '../../../models';
import { BASE_SPACE_ID, isRemoteSpace, Space } from '../../../models/space';
import { showAlert, showPrompt } from '../../components/modals';
import { setActiveActivity, setActiveSpace } from './global';

export const createSpace = () => dispatch => {
  const defaultValue = 'My Space';

  showPrompt({
    title: `Create New ${strings.space.singular}`,
    submitName: 'Create',
    cancelable: true,
    placeholder: defaultValue,
    defaultValue,
    selectText: true,
    onComplete: async name => {
      const space = await models.space.create({ name });
      trackEvent('Space', 'Create');
      dispatch(setActiveSpace(space._id));
      dispatch(setActiveActivity(ACTIVITY_HOME));
      trackSegmentEvent('Local Space Created');
    },
  });
};

export const removeSpace = (space: Space) => dispatch => {
  const message = isRemoteSpace(space)
    ? `Deleting a ${strings.remoteSpace.singular.toLowerCase()} ${strings.space.singular.toLowerCase()} will delete all local copies and changes of ${strings.document.plural.toLowerCase()} and ${strings.collection.plural.toLowerCase()} within. All changes that are not synced will be lost. The ${strings.remoteSpace.singular.toLowerCase()} ${strings.space.singular.toLowerCase()} will continue to exist remotely. Deleting this ${strings.space.singular.toLowerCase()} locally cannot be undone. Are you sure you want to delete ${space.name}?`
    : `Deleting a space will delete all ${strings.document.plural.toLowerCase()} and ${strings.collection.plural.toLowerCase()} within. This cannot be undone. Are you sure you want to delete ${space.name}?`;

  showAlert({
    title: `Delete ${strings.space.singular}`,
    message,
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
