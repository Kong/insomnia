import electron from 'electron';
import React from 'react';
import {combineReducers} from 'redux';
import fs from 'fs';

import * as importUtils from '../../../common/import';
import {trackEvent} from '../../../analytics';
import AlertModal from '../../components/modals/alert-modal';
import {showModal} from '../../components/modals';
import PaymentNotificationModal from '../../components/modals/payment-notification-modal';
import LoginModal from '../../components/modals/login-modal';
import * as models from '../../../models';

const LOCALSTORAGE_PREFIX = `insomnia::meta`;

const LOAD_START = 'global/load-start';
const LOAD_STOP = 'global/load-stop';
const LOAD_REQUEST_START = 'global/load-request-start';
const LOAD_REQUEST_STOP = 'global/load-request-stop';
const REQUEST_GROUP_TOGGLE_COLLAPSE = 'global/request-group-toggle';
const SET_ACTIVE_WORKSPACE = 'global/activate-workspace';
const COMMAND_ALERT = 'app/alert';
const COMMAND_LOGIN = 'app/auth/login';
const COMMAND_TRIAL_END = 'app/billing/trial-end';
const COMMAND_IMPORT_URI = 'app/import';

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

function loadingRequestsReducer (state = {}, action) {
  switch (action.type) {
    case LOAD_REQUEST_START:
      return Object.assign({}, state, {[action.requestId]: action.time});
    case LOAD_REQUEST_STOP:
      return Object.assign({}, state, {[action.requestId]: -1});
    default:
      return state;
  }
}

export const reducer = combineReducers({
  isLoading: loadingReducer,
  loadingRequestIds: loadingRequestsReducer,
  activeWorkspaceId: activeWorkspaceReducer
});

// ~~~~~~~ //
// ACTIONS //
// ~~~~~~~ //

export function newCommand (command, args) {
  return async dispatch => {
    // TODO: Make this use reducer when Modals ported to Redux
    if (command === COMMAND_ALERT) {
      const {message, title} = args;
      showModal(AlertModal, {title, message});
    } else if (command === COMMAND_LOGIN) {
      const {title, message} = args;
      showModal(LoginModal, {title, message});
    } else if (command === COMMAND_TRIAL_END) {
      showModal(PaymentNotificationModal);
    } else if (command === COMMAND_IMPORT_URI) {
      await showModal(AlertModal, {
        title: 'Confirm Data Import',
        message: <span>Do you really want to import <code>{args.uri}</code>?</span>,
        addCancel: true
      });
      dispatch(importUri(args.workspaceId, args.uri));
    }
  };
}

export function loadStart () {
  return {type: LOAD_START};
}

export function loadStop () {
  return {type: LOAD_STOP};
}

export function loadRequestStart (requestId) {
  return {type: LOAD_REQUEST_START, requestId, time: Date.now()};
}

export function loadRequestStop (requestId) {
  return {type: LOAD_REQUEST_STOP, requestId};
}

export function setActiveWorkspace (workspaceId) {
  window.localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activeWorkspaceId`, JSON.stringify(workspaceId));
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

    const options = {
      title: 'Import Insomnia Data',
      buttonLabel: 'Import',
      properties: ['openFile'],
      filters: [{
        // Allow empty extension and JSON
        name: 'Insomnia Import',
        extensions: [
          '', 'sh', 'txt', 'json', 'har', 'curl', 'bash', 'shell'
        ]
      }]
    };

    electron.remote.dialog.showOpenDialog(options, async paths => {
      if (!paths) {
        // It was cancelled, so let's bail out
        dispatch(loadStop());
        trackEvent('Import File', 'Cancel');
        return;
      }

      // Let's import all the paths!
      for (const path of paths) {
        try {
          const uri = `file://${path}`;
          await importUtils.importUri(workspaceId, uri);
          trackEvent('Import File', 'Success');
        } catch (err) {
          showModal(AlertModal, {title: 'Import Failed', message: err + ''});
          trackEvent('Import File', 'Failure');
        } finally {
          dispatch(loadStop());
        }
      }
    });
  };
}

export function importUri (workspaceId, uri) {
  return async dispatch => {
    dispatch(loadStart());
    try {
      await importUtils.importUri(workspaceId, uri);
      trackEvent('Import URI', 'Success');
    } catch (err) {
      trackEvent('Import URI', 'Failure');
      showModal(AlertModal, {title: 'Import Failed', message: err + ''});
    } finally {
      dispatch(loadStop());
    }
  };
}

export function exportFile (workspaceId = null) {
  return async dispatch => {
    dispatch(loadStart());

    const workspace = await models.workspace.getById(workspaceId);
    const json = await importUtils.exportJSON(workspace);
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
  };
}

export function init () {
  let workspaceId = null;

  try {
    const key = `${LOCALSTORAGE_PREFIX}::activeWorkspaceId`;
    const item = window.localStorage.getItem(key);
    workspaceId = JSON.parse(item);
  } catch (e) {
    // Nothing here...
  }

  return setActiveWorkspace(workspaceId);
}
