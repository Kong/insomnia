import electron from 'electron';
import {combineReducers} from 'redux';
import fs from 'fs';

import {importJSON, exportJSON} from '../../../backend/export/database';
import {trackEvent} from '../../../backend/ganalytics';
import AlertModal from '../../components/modals/AlertModal';
import {showModal} from '../../components/modals/index';
import PaymentModal from '../../components/modals/PaymentModal';
import LoginModal from '../../components/modals/LoginModal';

const LOAD_START = 'global/load-start';
const LOAD_STOP = 'global/load-stop';
const REQUEST_ACTIVATE = 'global/request-activate';
const CHANGE_FILTER = 'global/change-filter';
const TOGGLE_SIDEBAR = 'global/toggle-sidebar';
const ACTIVATE_WORKSPACE = 'global/activate-workspace';
const SET_SIDEBAR_WIDTH = 'global/set-sidebar-width';
const SET_PANE_WIDTH = 'global/set-pane-width';
const COMMAND_ALERT = 'app/alert';
const COMMAND_LOGIN = 'app/auth/login';
const COMMAND_TRIAL_END = 'app/billing/trial-end';


// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

/** Helper to update workspace metadata */
function updateMeta (state = {}, workspaceId, value, key) {
  const newState = Object.assign({}, state);
  newState[workspaceId] = newState[workspaceId] || {};
  newState[workspaceId][key] = value;
  return newState;
}

function workspaceMetaReducer (state = {}, action) {
  switch (action.type) {
    case SET_PANE_WIDTH:
      return updateMeta(state, action.workspaceId, action.width, 'paneWidth');
    case SET_SIDEBAR_WIDTH:
      return updateMeta(state, action.workspaceId, action.width, 'sidebarWidth');
    case CHANGE_FILTER:
      return updateMeta(state, action.workspaceId, action.filter, 'filter');
    case TOGGLE_SIDEBAR:
      const meta = state[action.workspaceId];
      const on = meta ? !meta.sidebarHidden : false;
      return updateMeta(state, action.workspaceId, on, 'sidebarHidden');
    case REQUEST_ACTIVATE:
      return updateMeta(
        state,
        action.workspaceId,
        action.requestId,
        'activeRequestId'
      );
    default:
      return state;
  }
}

function activeWorkspaceReducer (state = '', action) {
  switch (action.type) {
    case ACTIVATE_WORKSPACE:
      return action.workspace._id;
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

function commandReducer (state = {}, action) {
  switch (action.type) {
    // Nothing yet...
    default:
      return state;
  }
}

export default combineReducers({
  loading: loadingReducer,
  workspaceMeta: workspaceMetaReducer,
  activeWorkspaceId: activeWorkspaceReducer,
  command: commandReducer,
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
    const {message, title} = args;
    showModal(PaymentModal, {message, title});
  }

  return {type: command, ...args};
}

export function loadStart () {
  return {type: LOAD_START};
}

export function loadStop () {
  return {type: LOAD_STOP};
}

export function activateWorkspace (workspace) {
  return {type: ACTIVATE_WORKSPACE, workspace};
}

export function importFile (workspace) {
  return dispatch => {
    dispatch(loadStart());

    const options = {
      title: 'Import Insomnia Data',
      buttonLabel: 'Import',
      properties: ['openFile'],
      filters: [{
        // Allow empty extension and JSON
        name: 'Insomnia Import', extensions: ['', 'json']
      }]
    };

    electron.remote.dialog.showOpenDialog(options, paths => {
      if (!paths) {
        // It was cancelled, so let's bail out
        dispatch(loadStop());
        trackEvent('Import', 'Cancel');
        return;
      }

      // Let's import all the paths!
      paths.map(path => {
        fs.readFile(path, 'utf8', async (err, data) => {
          dispatch(loadStop());

          if (err) {
            trackEvent('Import', 'Failure');
            console.warn('Import Failed', err);
            return;
          }

          importJSON(workspace, data);
          trackEvent('Import', 'Success');
        });
      })
    });
  }
}

export function setPaneWidth (workspace, width) {
  return {
    type: SET_PANE_WIDTH,
    workspaceId: workspace._id,
    width: width
  };
}

export function setSidebarWidth (workspace, width) {
  return {
    type: SET_SIDEBAR_WIDTH,
    workspaceId: workspace._id,
    width: width
  };
}

export function toggleSidebar (workspace) {
  return {
    type: TOGGLE_SIDEBAR,
    workspaceId: workspace._id
  };
}

export function changeFilter (workspace, filter) {
  return {
    type: CHANGE_FILTER,
    filter: filter,
    workspaceId: workspace._id
  };
}

export function activateRequest (workspace, request) {
  return {
    type: REQUEST_ACTIVATE,
    requestId: request._id,
    workspaceId: workspace._id
  };
}

export function exportFile (parentDoc = null) {
  return async dispatch => {
    dispatch(loadStart());

    const json = await exportJSON(parentDoc);
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
