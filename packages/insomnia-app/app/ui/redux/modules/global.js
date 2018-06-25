import electron from 'electron';
import * as React from 'react';
import { combineReducers } from 'redux';
import fs from 'fs';
import path from 'path';
import AskModal from '../../../ui/components/modals/ask-modal';
import * as moment from 'moment';

import * as importUtils from '../../../common/import';
import AlertModal from '../../components/modals/alert-modal';
import PaymentNotificationModal from '../../components/modals/payment-notification-modal';
import LoginModal from '../../components/modals/login-modal';
import * as models from '../../../models';
import SelectModal from '../../components/modals/select-modal';
import { showError, showModal } from '../../components/modals/index';

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

function activeWorkspaceReducer(state = null, action) {
  switch (action.type) {
    case SET_ACTIVE_WORKSPACE:
      return action.workspaceId;
    default:
      return state;
  }
}

function loadingReducer(state = false, action) {
  switch (action.type) {
    case LOAD_START:
      return true;
    case LOAD_STOP:
      return false;
    default:
      return state;
  }
}

function loadingRequestsReducer(state = {}, action) {
  switch (action.type) {
    case LOAD_REQUEST_START:
      return Object.assign({}, state, { [action.requestId]: action.time });
    case LOAD_REQUEST_STOP:
      return Object.assign({}, state, { [action.requestId]: -1 });
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

export function newCommand(command, args) {
  return async dispatch => {
    switch (command) {
      case COMMAND_ALERT:
        showModal(AlertModal, { title: args.title, message: args.message });
        break;
      case COMMAND_LOGIN:
        showModal(LoginModal, { title: args.title, message: args.message });
        break;
      case COMMAND_TRIAL_END:
        showModal(PaymentNotificationModal);
        break;
      case COMMAND_IMPORT_URI:
        await showModal(AlertModal, {
          title: 'Confirm Data Import',
          message: (
            <span>
              Do you really want to import <code>{args.uri}</code>?
            </span>
          ),
          addCancel: true
        });
        dispatch(importUri(args.workspaceId, args.uri));
        break;
    }
  };
}

export function loadStart() {
  return { type: LOAD_START };
}

export function loadStop() {
  return { type: LOAD_STOP };
}

export function loadRequestStart(requestId) {
  return { type: LOAD_REQUEST_START, requestId, time: Date.now() };
}

export function loadRequestStop(requestId) {
  return { type: LOAD_REQUEST_STOP, requestId };
}

export function setActiveWorkspace(workspaceId) {
  window.localStorage.setItem(
    `${LOCALSTORAGE_PREFIX}::activeWorkspaceId`,
    JSON.stringify(workspaceId)
  );
  return { type: SET_ACTIVE_WORKSPACE, workspaceId };
}

export function toggleRequestGroup(requestGroup) {
  return {
    type: REQUEST_GROUP_TOGGLE_COLLAPSE,
    requestGroupId: requestGroup._id
  };
}

export function importFile(workspaceId) {
  return async dispatch => {
    dispatch(loadStart());

    const options = {
      title: 'Import Insomnia Data',
      buttonLabel: 'Import',
      properties: ['openFile'],
      filters: [
        {
          name: 'Insomnia Import',
          extensions: [
            '',
            'sh',
            'txt',
            'json',
            'har',
            'curl',
            'bash',
            'shell',
            'yaml',
            'yml'
          ]
        }
      ]
    };

    electron.remote.dialog.showOpenDialog(options, async paths => {
      if (!paths) {
        // It was cancelled, so let's bail out
        dispatch(loadStop());
        return;
      }

      // Let's import all the paths!
      for (const p of paths) {
        try {
          const uri = `file://${p}`;
          await importUtils.importUri(workspaceId, uri);
        } catch (err) {
          showModal(AlertModal, { title: 'Import Failed', message: err + '' });
        } finally {
          dispatch(loadStop());
        }
      }
    });
  };
}

export function importUri(workspaceId, uri) {
  return async dispatch => {
    dispatch(loadStart());
    try {
      await importUtils.importUri(workspaceId, uri);
    } catch (err) {
      showModal(AlertModal, { title: 'Import Failed', message: err + '' });
    } finally {
      dispatch(loadStop());
    }
  };
}

export function exportFile(workspaceId = null) {
  return dispatch => {
    dispatch(loadStart());

    const VALUE_JSON = 'json';
    const VALUE_HAR = 'har';

    showModal(SelectModal, {
      title: 'Select Export Type',
      options: [
        {
          name: 'Insomnia – Sharable with other Insomnia users',
          value: VALUE_JSON
        },
        { name: 'HAR – HTTP Archive Format', value: VALUE_HAR }
      ],
      message: 'Which format would you like to export as?',
      onCancel: () => {
        dispatch(loadStop());
      },
      onDone: async selectedFormat => {
        const workspace = await models.workspace.getById(workspaceId);

        // Check if we want to export private environments
        let environments;
        if (workspace) {
          const parentEnv = await models.environment.getOrCreateForWorkspace(
            workspace
          );
          environments = [
            parentEnv,
            ...(await models.environment.findByParentId(parentEnv._id))
          ];
        } else {
          environments = await models.environment.all();
        }

        let exportPrivateEnvironments = false;
        const privateEnvironments = environments.filter(e => e.isPrivate);
        if (privateEnvironments.length) {
          const names = privateEnvironments.map(e => e.name).join(', ');
          exportPrivateEnvironments = await showModal(AskModal, {
            title: 'Export Private Environments?',
            message: `Do you want to include private environments (${names}) in your export?`
          });
        }

        const date = moment().format('YYYY-MM-DD');
        const name = (workspace ? workspace.name : 'Insomnia All').replace(
          / /g,
          '-'
        );
        const lastDir = window.localStorage.getItem('insomnia.lastExportPath');
        const dir = lastDir || electron.remote.app.getPath('desktop');

        const options = {
          title: 'Export Insomnia Data',
          buttonLabel: 'Export',
          defaultPath: path.join(dir, `${name}_${date}`),
          filters: []
        };

        if (selectedFormat === VALUE_HAR) {
          options.filters = [
            {
              name: 'HTTP Archive 1.2',
              extensions: ['har', 'har.json', 'json']
            }
          ];
        } else {
          options.filters = [{ name: 'Insomnia Export', extensions: ['json'] }];
        }

        electron.remote.dialog.showSaveDialog(options, async filename => {
          if (!filename) {
            // It was cancelled, so let's bail out
            dispatch(loadStop());
            return;
          }

          let json;
          try {
            if (selectedFormat === VALUE_HAR) {
              json = await importUtils.exportHAR(
                workspace,
                exportPrivateEnvironments
              );
            } else {
              json = await importUtils.exportJSON(
                workspace,
                exportPrivateEnvironments
              );
            }
          } catch (err) {
            showError({
              title: 'Export Failed',
              error: err,
              message: 'Export failed due to an unexpected error'
            });
            dispatch(loadStop());
            return;
          }

          // Remember last exported path
          window.localStorage.setItem(
            'insomnia.lastExportPath',
            path.dirname(filename)
          );

          fs.writeFile(filename, json, {}, err => {
            if (err) {
              console.warn('Export failed', err);
              return;
            }
            dispatch(loadStop());
          });
        });
      }
    });
  };
}

export function init() {
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
