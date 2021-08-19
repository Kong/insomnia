import { SegmentEvent, trackEvent, trackSegmentEvent } from '../../../common/analytics';
import { ACTIVITY_HOME } from '../../../common/constants';
import { strings } from '../../../common/strings';
import * as models from '../../../models';
import { BASE_PROJECT_ID, isRemoteProject, Project } from '../../../models/project';
import { showAlert, showPrompt } from '../../components/modals';
import { setActiveActivity, setActiveSpace } from './global';

export const createSpace = () => dispatch => {
  const defaultValue = `My ${strings.project.singular}`;

  showPrompt({
    title: `Create New ${strings.project.singular}`,
    submitName: 'Create',
    cancelable: true,
    placeholder: defaultValue,
    defaultValue,
    selectText: true,
    onComplete: async name => {
      const space = await models.project.create({ name });
      trackEvent('Project', 'Create');
      dispatch(setActiveSpace(space._id));
      dispatch(setActiveActivity(ACTIVITY_HOME));
      trackSegmentEvent(SegmentEvent.projectLocalCreate);
    },
  });
};

export const removeSpace = (space: Project) => dispatch => {
  const message = isRemoteProject(space)
    ? `Deleting a ${strings.remoteProject.singular.toLowerCase()} ${strings.project.singular.toLowerCase()} will delete all local copies and changes of ${strings.document.plural.toLowerCase()} and ${strings.collection.plural.toLowerCase()} within. All changes that are not synced will be lost. The ${strings.remoteProject.singular.toLowerCase()} ${strings.project.singular.toLowerCase()} will continue to exist remotely. Deleting this ${strings.project.singular.toLowerCase()} locally cannot be undone. Are you sure you want to delete ${space.name}?`
    : `Deleting a ${strings.project.singular.toLowerCase()} will delete all ${strings.document.plural.toLowerCase()} and ${strings.collection.plural.toLowerCase()} within. This cannot be undone. Are you sure you want to delete ${space.name}?`;

  showAlert({
    title: `Delete ${strings.project.singular}`,
    message,
    addCancel: true,
    okLabel: 'Delete',
    onConfirm: async () => {
      await models.stats.incrementDeletedRequestsForDescendents(space);
      await models.project.remove(space);
      trackEvent('Project', 'Delete');
      // Show base space
      dispatch(setActiveSpace(BASE_PROJECT_ID));
      // Show home in case not already on home
      dispatch(setActiveActivity(ACTIVITY_HOME));
      trackSegmentEvent(SegmentEvent.projectLocalDelete);
    },
  });
};
