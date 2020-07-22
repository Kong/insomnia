// @flow
import electron from 'electron';
import * as React from 'react';
import { combineReducers } from 'redux';
import fs from 'fs';
import path from 'path';
import AskModal from '../../../ui/components/modals/ask-modal';
import * as moment from 'moment';

import type { ImportResult } from '../../../common/import';
import * as importUtils from '../../../common/import';
import AlertModal from '../../components/modals/alert-modal';
import PaymentNotificationModal from '../../components/modals/payment-notification-modal';
import LoginModal from '../../components/modals/login-modal';
import * as models from '../../../models';
import SelectModal from '../../components/modals/select-modal';
import { showError, showModal } from '../../components/modals/index';
import * as db from '../../../common/database';
import { trackEvent } from '../../../common/analytics';
import SettingsModal, {
  TAB_INDEX_PLUGINS,
  TAB_INDEX_THEMES,
} from '../../components/modals/settings-modal';
import install from '../../../plugins/install';
import type { ForceToWorkspace } from './helpers';
import { askToImportIntoWorkspace, ensureActivityIsForApp } from './helpers';
import { createPlugin } from '../../../plugins/create';
import { reloadPlugins } from '../../../plugins';
import { setTheme } from '../../../plugins/misc';
import { setActivityAttribute } from '../../../common/misc';
import { isDevelopment } from '../../../common/constants';
import type { Workspace } from '../../../models/workspace';
import type { GlobalActivity } from '../../../common/constants';

const LOCALSTORAGE_PREFIX = 'insomnia::meta';

const LOGIN_STATE_CHANGE = 'global/login-state-change';
const LOAD_START = 'global/load-start';
const LOAD_STOP = 'global/load-stop';
const LOAD_REQUEST_START = 'global/load-request-start';
const LOAD_REQUEST_STOP = 'global/load-request-stop';
const SET_ACTIVE_WORKSPACE = 'global/activate-workspace';
const SET_ACTIVE_ACTIVITY = 'global/activate-activity';
const COMMAND_ALERT = 'app/alert';
const COMMAND_LOGIN = 'app/auth/login';
const COMMAND_TRIAL_END = 'app/billing/trial-end';
const COMMAND_IMPORT_URI = 'app/import';
const COMMAND_PLUGIN_INSTALL = 'plugins/install';
const COMMAND_PLUGIN_THEME = 'plugins/theme';

// ~~~~~~~~ //
// REDUCERS //
// ~~~~~~~~ //

function activeActivityReducer(state = null, action) {
  switch (action.type) {
    case SET_ACTIVE_ACTIVITY:
      return action.activity;
    default:
      return state;
  }
}

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

function loginStateChangeReducer(state = false, action) {
  switch (action.type) {
    case LOGIN_STATE_CHANGE:
      return action.loggedIn;
    default:
      return state;
  }
}

export const reducer = combineReducers({
  isLoading: loadingReducer,
  loadingRequestIds: loadingRequestsReducer,
  activeWorkspaceId: activeWorkspaceReducer,
  activeActivity: activeActivityReducer,
  isLoggedIn: loginStateChangeReducer,
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
              Do you really want to import <code>{args.name || args.uri}</code>?
            </span>
          ),
          addCancel: true,
        });
        dispatch(importUri(args.workspaceId, args.uri));
        break;
      case COMMAND_PLUGIN_INSTALL:
        showModal(AskModal, {
          title: 'Plugin Install',
          message: (
            <React.Fragment>
              Do you want to install <code>{args.name}</code>?
            </React.Fragment>
          ),
          yesText: 'Install',
          noText: 'Cancel',
          onDone: async isYes => {
            if (!isYes) {
              return;
            }

            try {
              await install(args.name);
              showModal(SettingsModal, TAB_INDEX_PLUGINS);
            } catch (err) {
              showError({
                title: 'Plugin Install',
                message: 'Failed to install plugin',
                error: err.message,
              });
            }
          },
        });
        break;
      case COMMAND_PLUGIN_THEME:
        const parsedTheme = JSON.parse(decodeURIComponent(args.theme));
        showModal(AskModal, {
          title: 'Install Theme',
          message: (
            <React.Fragment>
              Do you want to install <code>{parsedTheme.displayName}</code>?
            </React.Fragment>
          ),
          yesText: 'Install',
          noText: 'Cancel',
          onDone: async isYes => {
            if (!isYes) {
              return;
            }

            const mainJsContent = `module.exports.themes = [${JSON.stringify(
              parsedTheme,
              null,
              2,
            )}];`;

            await createPlugin(`theme-${parsedTheme.name}`, '0.0.1', mainJsContent);

            const settings = await models.settings.getOrCreate();
            await models.settings.update(settings, { theme: parsedTheme.name });
            await reloadPlugins(true);
            await setTheme(parsedTheme.name);
            showModal(SettingsModal, TAB_INDEX_THEMES);
          },
        });
        break;
      default:
      // Nothing
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

export function loginStateChange(loggedIn) {
  return { type: LOGIN_STATE_CHANGE, loggedIn };
}

export function loadRequestStop(requestId) {
  return { type: LOAD_REQUEST_STOP, requestId };
}

export function setActiveActivity(activity: GlobalActivity) {
  let goToActivity = activity;

  // If development, skip logic (to allow for real-time switching)
  if (!isDevelopment()) {
    goToActivity = ensureActivityIsForApp(activity);
  }

  window.localStorage.setItem(`${LOCALSTORAGE_PREFIX}::activity`, JSON.stringify(goToActivity));
  setActivityAttribute(goToActivity);
  trackEvent('Activity', 'Change', goToActivity);
  return { type: SET_ACTIVE_ACTIVITY, activity: goToActivity };
}

export function setActiveWorkspace(workspaceId: string) {
  const key = `${LOCALSTORAGE_PREFIX}::activeWorkspaceId`;
  window.localStorage.setItem(key, JSON.stringify(workspaceId));
  return { type: SET_ACTIVE_WORKSPACE, workspaceId };
}

export function importFile(workspaceId: string, forceToWorkspace?: ForceToWorkspace) {
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
            'yml',
            'wsdl',
          ],
        },
      ],
    };

    electron.remote.dialog.showOpenDialog(options, async paths => {
      if (!paths) {
        // It was cancelled, so let's bail out
        dispatch(loadStop());
        return;
      }

      // Let's import all the paths!
      let importedWorkspaces = [];
      for (const p of paths) {
        try {
          const uri = `file://${p}`;
          const result = await importUtils.importUri(
            askToImportIntoWorkspace(workspaceId, forceToWorkspace),
            uri,
          );
          importedWorkspaces = handleImportResult(
            result,
            'The file does not contain a valid specification.',
          );
        } catch (err) {
          showModal(AlertModal, { title: 'Import Failed', message: err + '' });
        } finally {
          dispatch(loadStop());
        }
      }

      if (importedWorkspaces.length === 1) {
        dispatch(setActiveWorkspace(importedWorkspaces[0]._id));
      }
    });
  };
}

function handleImportResult(result: ImportResult, errorMessage: string): Array<Workspace> {
  const { error, summary } = result;

  if (error) {
    showError({ title: 'Import Failed', message: errorMessage, error });
    return [];
  }

  return summary[models.workspace.type] || [];
}

export function importClipBoard(workspaceId: string, forceToWorkspace?: ForceToWorkspace) {
  return async dispatch => {
    dispatch(loadStart());
    const schema = electron.clipboard.readText();
    if (!schema) {
      showModal(AlertModal, {
        title: 'Import Failed',
        message: 'Your clipboard appears to be empty.',
      });
      return;
    }
    // Let's import all the paths!
    let importedWorkspaces = [];
    try {
      const result = await importUtils.importRaw(
        askToImportIntoWorkspace(workspaceId, forceToWorkspace),
        schema,
      );
      importedWorkspaces = handleImportResult(
        result,
        'Your clipboard does not contain a valid specification.',
      );
    } catch (err) {
      showModal(AlertModal, {
        title: 'Import Failed',
        message: 'Your clipboard does not contain a valid specification.',
      });
    } finally {
      dispatch(loadStop());
    }
    if (importedWorkspaces.length === 1) {
      dispatch(setActiveWorkspace(importedWorkspaces[0]._id));
    }
  };
}

export function importUri(workspaceId: string, uri: string, forceToWorkspace?: ForceToWorkspace) {
  return async dispatch => {
    dispatch(loadStart());

    let importedWorkspaces = [];
    try {
      const result = await importUtils.importUri(
        askToImportIntoWorkspace(workspaceId, forceToWorkspace),
        uri,
      );
      importedWorkspaces = handleImportResult(
        result,
        'The URI does not contain a valid specification.',
      );
    } catch (err) {
      showModal(AlertModal, { title: 'Import Failed', message: err + '' });
    } finally {
      dispatch(loadStop());
    }

    if (importedWorkspaces.length === 1) {
      dispatch(setActiveWorkspace(importedWorkspaces[0]._id));
    }
  };
}

const VALUE_JSON = 'json';
const VALUE_YAML = 'yaml';
const VALUE_HAR = 'har';

function showSelectExportTypeModal(onCancel, onDone) {
  showModal(SelectModal, {
    title: 'Select Export Type',
    options: [
      {
        name: 'Insomnia v4 (JSON)',
        value: VALUE_JSON,
      },
      {
        name: 'Insomnia v4 (YAML)',
        value: VALUE_YAML,
      },
      { name: 'HAR – HTTP Archive Format', value: VALUE_HAR },
    ],
    message: 'Which format would you like to export as?',
    onCancel: onCancel,
    onDone: onDone,
  });
}

function showExportPrivateEnvironmentsModal(privateEnvNames) {
  return showModal(AskModal, {
    title: 'Export Private Environments?',
    message: `Do you want to include private environments (${privateEnvNames}) in your export?`,
  });
}

function showSaveExportedFileDialog(exportedFileNamePrefix, selectedFormat, onDone) {
  const date = moment().format('YYYY-MM-DD');
  const name = exportedFileNamePrefix.replace(/ /g, '-');
  const lastDir = window.localStorage.getItem('insomnia.lastExportPath');
  const dir = lastDir || electron.remote.app.getPath('desktop');

  const options = {
    title: 'Export Insomnia Data',
    buttonLabel: 'Export',
    defaultPath: path.join(dir, `${name}_${date}`),
    filters: [],
  };

  if (selectedFormat === VALUE_HAR) {
    options.filters = [
      {
        name: 'HTTP Archive 1.2',
        extensions: ['har', 'har.json', 'json'],
      },
    ];
  } else if (selectedFormat === VALUE_YAML) {
    options.filters = [{ name: 'Insomnia Export', extensions: ['yaml'] }];
  } else {
    options.filters = [{ name: 'Insomnia Export', extensions: ['json'] }];
  }

  electron.remote.dialog.showSaveDialog(options, onDone);
}

function writeExportedFileToFileSystem(filename, jsonData, onDone) {
  // Remember last exported path
  window.localStorage.setItem('insomnia.lastExportPath', path.dirname(filename));
  fs.writeFile(filename, jsonData, {}, onDone);
}

export function exportWorkspacesToFile(workspaceId = null) {
  return async dispatch => {
    dispatch(loadStart());

    showSelectExportTypeModal(
      () => dispatch(loadStop()),
      async selectedFormat => {
        const workspace = await models.workspace.getById(workspaceId);

        // Check if we want to export private environments.
        let environments;
        if (workspace) {
          const parentEnv = await models.environment.getOrCreateForWorkspace(workspace);
          environments = [parentEnv, ...(await models.environment.findByParentId(parentEnv._id))];
        } else {
          environments = await models.environment.all();
        }

        let exportPrivateEnvironments = false;
        const privateEnvironments = environments.filter(e => e.isPrivate);
        if (privateEnvironments.length) {
          const names = privateEnvironments.map(e => e.name).join(', ');
          exportPrivateEnvironments = await showExportPrivateEnvironmentsModal(names);
        }

        const fileNamePrefix = (workspace ? workspace.name : 'Insomnia All').replace(/ /g, '-');
        showSaveExportedFileDialog(fileNamePrefix, selectedFormat, async fileName => {
          if (!fileName) {
            // Cancelled.
            dispatch(loadStop());
            return;
          }

          let stringifiedExport;
          try {
            if (selectedFormat === VALUE_HAR) {
              stringifiedExport = await importUtils.exportWorkspacesHAR(
                workspace,
                exportPrivateEnvironments,
              );
            } else if (selectedFormat === VALUE_YAML) {
              stringifiedExport = await importUtils.exportWorkspacesData(
                workspace,
                exportPrivateEnvironments,
                'yaml',
              );
            } else {
              stringifiedExport = await importUtils.exportWorkspacesData(
                workspace,
                exportPrivateEnvironments,
                'json',
              );
            }
          } catch (err) {
            showError({
              title: 'Export Failed',
              error: err,
              message: 'Export failed due to an unexpected error',
            });
            dispatch(loadStop());
            return;
          }

          writeExportedFileToFileSystem(fileName, stringifiedExport, err => {
            if (err) {
              console.warn('Export failed', err);
            }
            dispatch(loadStop());
          });
        });
      },
    );
  };
}

export function exportRequestsToFile(requestIds) {
  return async dispatch => {
    dispatch(loadStart());

    showSelectExportTypeModal(
      () => dispatch(loadStop()),
      async selectedFormat => {
        const requests = [];
        const privateEnvironments = [];
        const workspaceLookup = {};
        for (const requestId of requestIds) {
          const request = await models.request.getById(requestId);
          if (request == null) {
            continue;
          }
          requests.push(request);

          const ancestors = await db.withAncestors(request, [
            models.workspace.type,
            models.requestGroup.type,
          ]);
          const workspace = ancestors.find(ancestor => ancestor.type === models.workspace.type);
          if (workspace == null || workspaceLookup.hasOwnProperty(workspace._id)) {
            continue;
          }
          workspaceLookup[workspace._id] = true;

          const descendants = await db.withDescendants(workspace);
          const privateEnvs = descendants.filter(
            descendant => descendant.type === models.environment.type && descendant.isPrivate,
          );
          privateEnvironments.push(...privateEnvs);
        }

        let exportPrivateEnvironments = false;
        if (privateEnvironments.length) {
          const names = privateEnvironments.map(e => e.name).join(', ');
          exportPrivateEnvironments = await showExportPrivateEnvironmentsModal(names);
        }

        const fileNamePrefix = 'Insomnia';
        showSaveExportedFileDialog(fileNamePrefix, selectedFormat, async fileName => {
          if (!fileName) {
            // Cancelled.
            dispatch(loadStop());
            return;
          }

          let stringifiedExport;
          try {
            if (selectedFormat === VALUE_HAR) {
              stringifiedExport = await importUtils.exportRequestsHAR(
                requests,
                exportPrivateEnvironments,
              );
            } else if (selectedFormat === VALUE_YAML) {
              stringifiedExport = await importUtils.exportRequestsData(
                requests,
                exportPrivateEnvironments,
                'yaml',
              );
            } else {
              stringifiedExport = await importUtils.exportRequestsData(
                requests,
                exportPrivateEnvironments,
                'json',
              );
            }
          } catch (err) {
            showError({
              title: 'Export Failed',
              error: err,
              message: 'Export failed due to an unexpected error',
            });
            dispatch(loadStop());
            return;
          }

          writeExportedFileToFileSystem(fileName, stringifiedExport, err => {
            if (err) {
              console.warn('Export failed', err);
            }
            dispatch(loadStop());
          });
        });
      },
    );
  };
}

export function init() {
  let workspaceId = null;
  let activity = null;

  try {
    const key = `${LOCALSTORAGE_PREFIX}::activeWorkspaceId`;
    const item = window.localStorage.getItem(key);
    workspaceId = JSON.parse(item);
  } catch (e) {
    // Nothing here...
  }

  try {
    const key = `${LOCALSTORAGE_PREFIX}::activity`;
    const item = window.localStorage.getItem(key);
    activity = JSON.parse(item);
  } catch (e) {
    // Nothing here...
  }

  // If the default app id is insomnia, then default to the insomnia view at initialization
  activity = ensureActivityIsForApp(activity);

  return [setActiveWorkspace(workspaceId), setActiveActivity(activity)];
}
