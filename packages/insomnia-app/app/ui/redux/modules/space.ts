import { ACTIVITY_HOME } from '../../../common/constants';
import { trackEvent, trackSegmentEvent } from '../../../common/analytics';
import { showPrompt } from '../../components/modals';
import { setActiveActivity, setActiveSpace } from './global';
import * as models from '../../../models';
import { strings } from '../../../common/strings';

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
