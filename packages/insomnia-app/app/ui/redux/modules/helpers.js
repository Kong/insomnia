// @flow
import { showModal } from '../../components/modals';
import AskModal from '../../components/modals/ask-modal';
import type { GlobalActivity } from '../../../common/constants';
import { ACTIVITY_HOME, ACTIVITY_INSOMNIA, getDefaultAppId } from '../../../common/constants';
import { APP_ID_INSOMNIA } from '../../../../config';

export const ForceToWorkspaceKeys = {
  new: 'new',
  current: 'current',
};

export type ForceToWorkspace = $Keys<typeof ForceToWorkspaceKeys>;

export function askToImportIntoWorkspace(workspaceId: string, forceToWorkspace?: ForceToWorkspace) {
  return function() {
    switch (forceToWorkspace) {
      case ForceToWorkspaceKeys.new:
        return null;
      case ForceToWorkspaceKeys.current:
        return workspaceId;
      default:
        return new Promise(resolve => {
          showModal(AskModal, {
            title: 'Import',
            message: 'Do you want to import into the current workspace or a new one?',
            yesText: 'Current',
            noText: 'New Workspace',
            onDone: yes => {
              resolve(yes ? workspaceId : null);
            },
          });
        });
    }
  };
}

// If app should be insomnia
//   then don't allow changing to another activity
// If not insomnia
//   then don't allow changing to ACTIVITY_INSOMNIA
export function ensureActivityIsForApp(activity: GlobalActivity): GlobalActivity {
  if (getDefaultAppId() === APP_ID_INSOMNIA) {
    return ACTIVITY_INSOMNIA;
  }

  if (activity === ACTIVITY_INSOMNIA) {
    return ACTIVITY_HOME;
  }

  return activity;
}
