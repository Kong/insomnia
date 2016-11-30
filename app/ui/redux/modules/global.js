import electron from 'electron';
import {combineReducers} from 'redux';
import fs from 'fs';

import {importRaw, exportJSON} from '../../../common/import';
import {trackEvent} from '../../../analytics';
import AlertModal from '../../components/modals/AlertModal';
import {showModal} from '../../components/modals';
import PaymentNotificationModal from '../../components/modals/PaymentNotificationModal';
import LoginModal from '../../components/modals/LoginModal';
import * as models from '../../../models';

const LOCALSTORAGE_PREFIX = `insomnia::meta`;

const LOAD_START = 'global/load-start';
const LOAD_STOP = 'global/load-stop';
const REQUEST_GROUP_TOGGLE_COLLAPSE = 'global/request-group-toggle';
const SET_ACTIVE_WORKSPACE = 'global/activate-workspace';
const COMMAND_ALERT = 'app/alert';
const COMMAND_LOGIN = 'app/auth/login';
const COMMAND_TRIAL_END = 'app/billing/trial-end';


// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

function activeWorkspaceReducer (state = null, action) {
  switch (action.type) {
    case SET_ACTIVE_WORKSPACE:
      return action.workspaceId;
    default:
      return state;
  }
}

function loadingReducer (state = false, action) {
  switch (action.type) {
    case LOAD_START:
      return true;
    case LOAD_STOP:
      return false;
    default:
      return state;
  }
}

export default combineReducers({
  isLoading: loadingReducer,
  activeWorkspaceId: activeWorkspaceReducer,
});


// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

export function newCommand (command, args) {
  // TODO: Make this use reducer when Modals ported to Redux
  if (command === COMMAND_ALERT) {
    const {message, title} = args;
    showModal(AlertModal, {title, message});
  } else if (command === COMMAND_LOGIN) {
    const {title, message} = args;
    showModal(LoginModal, {title, message});
  } else if (command === COMMAND_TRIAL_END) {
    showModal(PaymentNotificationModal);
  }

  return {type: command, ...args};
}

export function loadStart () {
  return {type: LOAD_START};
}

export function loadStop () {
  return {type: LOAD_STOP};
}

export function setActiveWorkspace (workspaceId) {
  localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activeWorkspaceId`, JSON.stringify(workspaceId));
  return {type: SET_ACTIVE_WORKSPACE, workspaceId};
}

export function toggleRequestGroup (requestGroup) {
  return {
    type: REQUEST_GROUP_TOGGLE_COLLAPSE,
    requestGroupId: requestGroup._id
  };
}

export function importFile (workspaceId) {
  return async dispatch => {
    dispatch(loadStart());

    const workspace = await models.workspace.getById(workspaceId);

    const options = {
      title: 'Import Insomnia Data',
      buttonLabel: 'Import',
      properties: ['openFile'],
      filters: [{
        // Allow empty extension and JSON
        name: 'Insomnia Import', extensions: [
          '', 'sh', 'txt', 'json', 'har', 'curl', 'bash', 'shell'
        ]
      }]
    };

    electron.remote.dialog.showOpenDialog(options, async paths => {
      if (!paths) {
        // It was cancelled, so let's bail out
        dispatch(loadStop());
        trackEvent('Import', 'Cancel');
        return;
      }

      // Let's import all the paths!
      for (const path of paths) {
        try {
          const data = fs.readFileSync(path, 'utf8');
          dispatch(loadStop());

          const summary = await importRaw(workspace, data);

          let statements = Object.keys(summary).map(type => {
            const count = summary[type].length;
            const name = models.getModelName(type, count);
            return count === 0 ? null :`${count} ${name}`;
          }).filter(s => s !== null);

          let message;
          if (statements.length === 0) {
            message = 'Nothing was found to import.';
          } else {
            message = `You imported ${statements.join(', ')}!`;
          }
          showModal(AlertModal, {title: 'Import Succeeded', message});
          trackEvent('Import', 'Success');
        } catch (e) {
          showModal(AlertModal, {title: 'Import Failed', message: e + ''});
          trackEvent('Import', 'Failure', e);
        }
      }
    });
  }
}

export function exportFile (workspaceId = null) {
  return async dispatch => {
    dispatch(loadStart());

    const workspace = await models.workspace.getById(workspaceId);
    const json = await exportJSON(workspace);
    const options = {
      title: 'Export Insomnia Data',
      buttonLabel: 'Export',
      filters: [{
        name: 'Insomnia Export', extensions: ['json']
      }]
    };

    electron.remote.dialog.showSaveDialog(options, filename => {
      if (!filename) {
        trackEvent('Export', 'Cancel');
        // It was cancelled, so let's bail out
        dispatch(loadStop());
        return;
      }

      fs.writeFile(filename, json, {}, err => {
        if (err) {
          console.warn('Export failed', err);
          trackEvent('Export', 'Failure');
          return;
        }
        trackEvent('Export', 'Success');
        dispatch(loadStop());
      });
    });
  }
}

export function init () {
  let workspaceId = null;

  try {
    workspaceId = JSON.parse(localStorage.getItem(`${LOCALSTORAGE_PREFIX}::activeWorkspaceId`));
  } catch (e) {
    // Nothing here...
  }

  return setActiveWorkspace(workspaceId);
}
